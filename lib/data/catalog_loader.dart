import 'dart:convert';
import 'dart:io';
import 'package:excel/excel.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path_provider/path_provider.dart';
import '../models/product.dart';
import 'product_classifier.dart';

/// Loads the product catalog directly from the Excel source file — no
/// intermediate JSON conversion — caches the parsed products in Hive for fast
/// startup, and supports re-importing a new Excel file at runtime.
class CatalogLoader {
  static const _assetPath = 'assets/catalog.xlsx';
  static const _boxName = 'catalog_cache';
  static const _sourceSetting = 'catalog_source_path';

  static List<Product> _products = [];
  static bool _loaded = false;
  static Box<String>? _cache;
  static String _sourcePath = '';

  static List<Product> get products => _products;
  static bool get isLoaded => _loaded;

  static Future<void> init() async {
    _cache = await Hive.openBox<String>(_boxName);
    _sourcePath = _cache!.get(_sourceSetting, defaultValue: '') ?? '';
  }

  /// Loads the catalog from the source Excel (bundled asset or last imported
  /// file). If parsing fails, falls back to the cached products.
  static Future<List<Product>> load() async {
    await init();
    final cacheProducts = _readCache();
    if (cacheProducts.isNotEmpty) {
      _products = cacheProducts;
      _loaded = true;
    }

    try {
      List<int> bytes;
      if (_sourcePath.isNotEmpty && File(_sourcePath).existsSync()) {
        bytes = File(_sourcePath).readAsBytesSync();
      } else {
        bytes = (await rootBundle.load(_assetPath)).buffer.asUint8List();
      }
      final parsed = _parseXlsx(bytes);
      if (parsed.isNotEmpty) {
        _products = parsed;
        await _writeCache(parsed);
        _loaded = true;
      }
    } catch (e) {
      // Fall back to whatever is in cache/products.
      if (_products.isEmpty) {
        // Last resort: try the bundled JSON (legacy).
        _products = await _loadLegacyJson();
        _loaded = true;
      }
    }
    return _products;
  }

  /// Re-imports the catalog from a user-selected Excel file.
  static Future<int> importFromFile(File file) async {
    final bytes = file.readAsBytesSync();
    final parsed = _parseXlsx(bytes);
    if (parsed.isEmpty) return 0;
    _products = parsed;
    _sourcePath = file.path;
    await _cache!.put(_sourceSetting, file.path);
    await _writeCache(parsed);
    _loaded = true;
    return parsed.length;
  }

  /// Clears the imported source so it falls back to the bundled asset.
  static Future<void> resetToAsset() async {
    _sourcePath = '';
    await _cache!.delete(_sourceSetting);
    try {
      final bytes = (await rootBundle.load(_assetPath)).buffer.asUint8List();
      final parsed = _parseXlsx(bytes);
      if (parsed.isNotEmpty) {
        _products = parsed;
        await _writeCache(parsed);
        _loaded = true;
      }
    } catch (_) {}
  }

  // --- Parsing ---

  static List<Product> _parseXlsx(List<int> bytes) {
    final excel = Excel.decodeBytes(bytes);
    final sheet = excel.tables.values.isNotEmpty ? excel.tables.values.first : null;
    if (sheet == null || sheet.rows.isEmpty) return [];

    // Find column indices from the header row.
    final header = sheet.rows.first;
    int col(String name) {
      for (var i = 0; i < header.length; i++) {
        final h = _cellText(header[i]).toUpperCase();
        if (h == name.toUpperCase()) return i;
      }
      return -1;
    }

    final iRef = col('Référence') >= 0 ? col('Référence') : col('Reference');
    final iName = col('Désignation') >= 0 ? col('Désignation') : col('Designation');
    final iQty = col('Quantité') >= 0 ? col('Quantité') : col('Quantite');
    final iFamily = col('Famille');
    final iSub1 = col('S/Famille 1');
    final iSub2 = col('S/Famille 2');
    final iSub3 = col('S/Famille 3');
    final iSupplier = col('Fournisseur');

    // Process data rows (skip header).
    final seen = <String>{};
    final products = <Product>[];
    for (var r = 1; r < sheet.rows.length; r++) {
      final row = sheet.rows[r];
      if (row.isEmpty) continue;

      final ref = iRef >= 0 && iRef < row.length ? _cellText(row[iRef]).trim() : '';
      if (ref.isEmpty || seen.contains(ref)) continue;
      seen.add(ref);

      final name = iName >= 0 && iName < row.length ? _cellText(row[iName]).trim() : '';
      final qty = iQty >= 0 && iQty < row.length ? _cellNum(row[iQty]) : 0.0;
      final family = iFamily >= 0 && iFamily < row.length ? _cellText(row[iFamily]).trim() : '';
      final sub1 = iSub1 >= 0 && iSub1 < row.length ? _cellText(row[iSub1]).trim() : '';
      final sub2 = iSub2 >= 0 && iSub2 < row.length ? _cellText(row[iSub2]).trim() : '';
      final sub3 = iSub3 >= 0 && iSub3 < row.length ? _cellText(row[iSub3]).trim() : '';
      final supplier = iSupplier >= 0 && iSupplier < row.length ? _cellText(row[iSupplier]).trim() : '';

      products.add(Product(
        ref: ref,
        name: name,
        qty: qty,
        family: family,
        sub1: sub1,
        sub2: sub2,
        sub3: sub3,
        supplier: supplier,
      ));
    }
    return products;
  }

  static String _cellText(dynamic cell) {
    if (cell == null) return '';
    final v = cell.value;
    if (v == null) return '';
    if (v is TextCellValue) return v.value.text ?? '';
    if (v is IntCellValue) return v.value.toString();
    if (v is DoubleCellValue) return _trimNum(v.value);
    if (v is BoolCellValue) return v.value ? '1' : '0';
    if (v is DateCellValue) {
      final m = v.month.toString().padLeft(2, '0');
      final d = v.day.toString().padLeft(2, '0');
      return '${v.year.toString().padLeft(4, '0')}-$m-$d';
    }
    if (v is DateTimeCellValue) return v.asDateTimeUtc().toIso8601String();
    return v.toString();
  }

  static double _cellNum(dynamic cell) {
    if (cell == null) return 0;
    final v = cell.value;
    if (v is IntCellValue) return v.value.toDouble();
    if (v is DoubleCellValue) return v.value;
    if (v is BoolCellValue) return v.value ? 1 : 0;
    if (v is TextCellValue) {
      return double.tryParse((v.value.text ?? '').replaceAll(',', '.')) ?? 0;
    }
    return 0;
  }

  static String _trimNum(double d) {
    if (d == d.roundToDouble()) return d.toInt().toString();
    return d.toString();
  }

  // --- Hive cache ---

  static List<Product> _readCache() {
    final raw = _cache?.get('products');
    if (raw == null) return [];
    try {
      final list = jsonDecode(raw) as List;
      return list.map((e) => Product.fromJson((e as Map).cast<String, dynamic>())).toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> _writeCache(List<Product> products) async {
    await _cache?.put('products', jsonEncode(products.map((p) => p.toJson()).toList()));
  }

  static Future<List<Product>> _loadLegacyJson() async {
    try {
      final data = await rootBundle.loadString('assets/products.json');
      final list = jsonDecode(data) as List;
      return list.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }

  // --- Lookups ---

  static List<String> get brands {
    final set = <String>{};
    for (final p in _products) {
      final b = ProductClassifier.detectBrand(p.name, p.ref);
      if (b.isNotEmpty) set.add(b);
      if (p.supplier.isNotEmpty) set.add(p.supplier);
    }
    return set.toList()..sort();
  }

  static List<String> get families {
    final set = <String>{};
    for (final p in _products) {
      final f = ProductClassifier.readableFamily(p.family);
      if (f.isNotEmpty) set.add(f);
    }
    return set.toList()..sort();
  }

  static List<Product> search(String query, {String? brand, String? family}) {
    final q = query.trim().toLowerCase();
    return _products.where((p) {
      if (brand != null && brand.isNotEmpty) {
        final b = ProductClassifier.detectBrand(p.name, p.ref);
        if (b != brand && p.supplier != brand) return false;
      }
      if (family != null && family.isNotEmpty) {
        final f = ProductClassifier.readableFamily(p.family);
        if (f != family) return false;
      }
      if (q.isEmpty) return true;
      return p.ref.toLowerCase().contains(q) ||
          p.name.toLowerCase().contains(q) ||
          p.supplier.toLowerCase().contains(q) ||
          ProductClassifier.detectBrand(p.name, p.ref).toLowerCase().contains(q);
    }).toList();
  }

  static Product? findByRef(String ref) {
    final r = ref.trim().toUpperCase();
    for (final p in _products) {
      if (p.ref.toUpperCase() == r) return p;
    }
    return null;
  }

  /// Fuzzy match: returns top matches with a score 0-100.
  static List<(Product, int)> fuzzyMatch(String text, {int limit = 5}) {
    final t = text.trim().toUpperCase();
    if (t.isEmpty) return [];

    final results = <(Product, int)>[];
    for (final p in _products) {
      final ref = p.ref.toUpperCase();
      final name = p.name.toUpperCase();

      if (ref == t) {
        results.add((p, 100));
        continue;
      }
      if (ref.contains(t) && t.length >= 2) {
        results.add((p, 90));
        continue;
      }
      if (t.contains(ref) && ref.length >= 3) {
        results.add((p, 85));
        continue;
      }
      if (name.contains(t) && t.length >= 2) {
        results.add((p, 80));
        continue;
      }
      final dist = _levenshtein(ref, t);
      final maxLen = ref.length > t.length ? ref.length : t.length;
      if (maxLen > 0 && t.length >= 3) {
        final score = (1 - dist / maxLen) * 100;
        if (score >= 60) {
          results.add((p, score.round()));
        }
      }
    }

    results.sort((a, b) => b.$2.compareTo(a.$2));
    return results.take(limit).toList();
  }

  static int _levenshtein(String a, String b) {
    if (a == b) return 0;
    if (a.isEmpty) return b.length;
    if (b.isEmpty) return a.length;

    final dp = List.generate(a.length + 1, (i) => List.filled(b.length + 1, 0));
    for (var i = 0; i <= a.length; i++) {
      dp[i][0] = i;
    }
    for (var j = 0; j <= b.length; j++) {
      dp[0][j] = j;
    }

    for (var i = 1; i <= a.length; i++) {
      for (var j = 1; j <= b.length; j++) {
        final cost = a[i - 1] == b[j - 1] ? 0 : 1;
        dp[i][j] = [
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        ].reduce((x, y) => x < y ? x : y);
      }
    }
    return dp[a.length][b.length];
  }

  /// Returns a temp path for an imported source file so tests/tools can reuse it.
  static Future<String> tempPath() async {
    final dir = await getApplicationDocumentsDirectory();
    return '${dir.path}/imported_catalog.xlsx';
  }
}