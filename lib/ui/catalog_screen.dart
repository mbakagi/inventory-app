import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../data/catalog_loader.dart';
import '../data/product_classifier.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../models/product.dart';
import 'taxonomy_screen.dart';

class CatalogScreen extends StatefulWidget {
  const CatalogScreen({super.key});

  @override
  State<CatalogScreen> createState() => _CatalogScreenState();
}

class _CatalogScreenState extends State<CatalogScreen> {
  final _searchCtrl = TextEditingController();
  String _query = '';
  String? _brand;
  String? _family;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final results = CatalogLoader.search(_query, brand: _brand, family: _family);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Product Catalog'),
        backgroundColor: Colors.blue.shade700,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.category),
            tooltip: 'Manage categories & brands',
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const TaxonomyScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.file_download),
            tooltip: 'Re-import Excel catalog',
            onPressed: _reimportExcel,
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search reference, name, brand...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchCtrl.clear();
                          setState(() => _query = '');
                        },
                      ),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          // Filters
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _brand,
                    decoration: const InputDecoration(labelText: 'Brand'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All brands')),
                      ...CatalogLoader.brands.map((b) => DropdownMenuItem(value: b, child: Text(b))),
                    ],
                    onChanged: (v) => setState(() => _brand = v),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    initialValue: _family,
                    decoration: const InputDecoration(labelText: 'Family'),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('All families')),
                      ...CatalogLoader.families.map((f) => DropdownMenuItem(value: f, child: Text(f))),
                    ],
                    onChanged: (v) => setState(() => _family = v),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Text('${results.length} products', style: Theme.of(context).textTheme.bodySmall),
          ),
          Expanded(
            child: ListView.builder(
              itemCount: results.length,
              itemBuilder: (ctx, i) {
                final p = results[i];
                final brand = ProductClassifier.detectBrand(p.name, p.ref);
                final fam = ProductClassifier.readableFamily(p.family);
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _colorFor(brand),
                    child: Text(brand.isNotEmpty ? brand[0] : '?'),
                  ),
                  title: Text(p.ref, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text(
                    [if (brand.isNotEmpty) brand, if (fam.isNotEmpty) fam, p.name]
                        .join(' | '),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: Text(p.qty.toStringAsFixed(0)),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => ProductDetailScreen(product: p)),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _reimportExcel() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['xlsx', 'xls']);
    if (result == null || result.files.single.path == null) return;
    final file = File(result.files.single.path!);
    try {
      final count = await CatalogLoader.importFromFile(file);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Imported $count products')),
      );
      setState(() {});
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Import failed: $e')),
      );
    }
  }

  Color _colorFor(String brand) {
    const colors = [
      Colors.red, Colors.blue, Colors.green, Colors.orange,
      Colors.purple, Colors.teal, Colors.indigo, Colors.pink,
      Colors.brown, Colors.cyan,
    ];
    if (brand.isEmpty) return Colors.grey;
    return colors[brand.hashCode.abs() % colors.length];
  }
}

class ProductDetailScreen extends StatelessWidget {
  final Product product;
  const ProductDetailScreen({super.key, required this.product});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(product.ref),
        backgroundColor: Colors.blue.shade700,
        foregroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(product.name, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          Center(
            child: QrImageView(data: product.ref, version: QrVersions.auto, size: 160),
          ),
          const SizedBox(height: 8),
          const Center(child: Text('Scan in Count Mode to add instantly', style: TextStyle(fontStyle: FontStyle.italic))),
          const SizedBox(height: 16),
          const SizedBox(height: 16),
          _InfoRow(label: 'Reference', value: product.ref),
          _InfoRow(label: 'Brand', value: product.supplier),
          _InfoRow(label: 'Family', value: product.family),
          _InfoRow(label: 'Sub-family 1', value: product.sub1),
          _InfoRow(label: 'Sub-family 2', value: product.sub2),
          _InfoRow(label: 'Sub-family 3', value: product.sub3),
          _InfoRow(label: 'Stock', value: product.qty.toStringAsFixed(0)),
          const SizedBox(height: 16),
          if (product.alternatives.isNotEmpty) ...[
            const Text('Alternatives', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ...product.alternatives.map((alt) {
              final altProduct = CatalogLoader.findByRef(alt);
              return Card(
                child: ListTile(
                  title: Text(alt),
                  subtitle: Text(altProduct?.name ?? 'Not in catalog'),
                  trailing: const Icon(Icons.swap_horiz),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
          ),
          Expanded(child: Text(value.isEmpty ? '-' : value)),
        ],
      ),
    );
  }
}