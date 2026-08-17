import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';

/// Stores user-defined taxonomy: brands, multi-level categories, and
/// per-product classification overrides. All data is persisted in Hive and
/// survives Excel re-imports.
class TaxonomyStore {
  static const _boxName = 'taxonomy';
  late Box<String> _box;

  Future<void> init() async {
    _box = await Hive.openBox<String>(_boxName);
  }

  // --- Generic helpers ---
  List<dynamic> _readList(String key) {
    final raw = _box.get(key);
    if (raw == null) return [];
    return jsonDecode(raw) as List;
  }

  Future<void> _writeList(String key, List<dynamic> list) async {
    await _box.put(key, jsonEncode(list));
  }

  // --- Brands ---
  List<String> get brands {
    final list = _readList('brands').cast<String>().toSet().toList()..sort();
    return list;
  }

  Future<void> addBrand(String brand) async {
    final b = brand.trim();
    if (b.isEmpty) return;
    final list = _readList('brands').cast<String>().toSet()..add(b);
    await _writeList('brands', list.toList());
  }

  Future<void> removeBrand(String brand) async {
    final list = _readList('brands').cast<String>().toSet()..remove(brand);
    await _writeList('brands', list.toList());
  }

  // --- Categories (multi-level tree) ---
  // Stored as a flat list of nodes: {id, parent, name}
  List<Map<String, dynamic>> get nodes {
    final raw = _readList('nodes');
    return raw.map((e) => (e as Map).cast<String, dynamic>()).toList();
  }

  List<Map<String, dynamic>> childrenOf(String parentId) {
    return nodes.where((n) => n['parent'] == parentId).toList()
      ..sort((a, b) => (a['name'] as String).compareTo(b['name'] as String));
  }

  List<Map<String, dynamic>> get roots => childrenOf('');

  Future<String> addNode(String parentId, String name) async {
    final n = name.trim();
    if (n.isEmpty) return '';
    final id = DateTime.now().microsecondsSinceEpoch.toString();
    final list = _readList('nodes').map((e) => (e as Map).cast<String, dynamic>()).toList()
      ..add({'id': id, 'parent': parentId, 'name': n});
    await _writeList('nodes', list);
    return id;
  }

  Future<void> renameNode(String id, String name) async {
    final n = name.trim();
    if (n.isEmpty) return;
    final list = _readList('nodes').map((e) => (e as Map).cast<String, dynamic>()).toList();
    for (final node in list) {
      if (node['id'] == id) {
        node['name'] = n;
        break;
      }
    }
    await _writeList('nodes', list);
  }

  Future<void> removeNode(String id) async {
    // Remove the node and all descendants
    final toRemove = <String>{id};
    bool changed = true;
    while (changed) {
      changed = false;
      for (final n in nodes) {
        if (toRemove.contains(n['parent']) && !toRemove.contains(n['id'])) {
          toRemove.add(n['id'] as String);
          changed = true;
        }
      }
    }
    final list = _readList('nodes')
        .map((e) => (e as Map).cast<String, dynamic>())
        .where((n) => !toRemove.contains(n['id']))
        .toList();
    await _writeList('nodes', list);
  }

  /// Returns names along a path from root to nodeId (exclusive of root).
  List<String> pathOf(String nodeId) {
    final byId = {for (final n in nodes) n['id'] as String: n};
    final path = <String>[];
    String? cur = nodeId;
    while (cur != null && cur.isNotEmpty) {
      final node = byId[cur];
      if (node == null) break;
      path.insert(0, node['name'] as String);
      cur = node['parent'] as String;
    }
    return path;
  }

  // --- Product overrides ---
  // Map ref -> {brand, family, sub1, sub2, sub3}
  Map<String, dynamic>? overrideFor(String ref) {
    final raw = _box.get('ovr_$ref');
    if (raw == null) return null;
    return (jsonDecode(raw) as Map).cast<String, dynamic>();
  }

  Future<void> setOverride(String ref, {String? brand, String? family, String? sub1, String? sub2, String? sub3}) async {
    await _box.put('ovr_$ref', jsonEncode({
      'brand': brand ?? '',
      'family': family ?? '',
      'sub1': sub1 ?? '',
      'sub2': sub2 ?? '',
      'sub3': sub3 ?? '',
    }));
  }

  Future<void> clearOverrides() async {
    final keys = _box.keys.where((k) => k.startsWith('ovr_')).toList();
    for (final k in keys) {
      await _box.delete(k);
    }
  }
}