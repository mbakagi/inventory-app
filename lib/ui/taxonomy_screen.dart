import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../data/product_classifier.dart';
import '../storage/taxonomy_store.dart';

class TaxonomyScreen extends StatefulWidget {
  const TaxonomyScreen({super.key});
  @override
  State<TaxonomyScreen> createState() => _TaxonomyScreenState();
}

class _TaxonomyScreenState extends State<TaxonomyScreen> {
  int _tab = 0;
  @override
  Widget build(BuildContext context) {
    final store = context.read<TaxonomyStore>();
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Taxonomy Manager'),
          backgroundColor: Colors.green.shade700,
          foregroundColor: Colors.white,
          bottom: TabBar(
            onTap: (i) => setState(() => _tab = i),
            tabs: const [Tab(text: 'Brands'), Tab(text: 'Categories'), Tab(text: 'Products')],
          ),
        ),
        body: _tab == 0
            ? _BrandsTab(store: store)
            : _tab == 1
                ? _CategoriesTab(store: store)
                : _ProductsTab(store: store),
      ),
    );
  }
}

class _BrandsTab extends StatefulWidget {
  final TaxonomyStore store;
  const _BrandsTab({required this.store});
  @override
  State<_BrandsTab> createState() => _BrandsTabState();
}

class _BrandsTabState extends State<_BrandsTab> {
  final _ctrl = TextEditingController();
  Future<void> _add() async {
    final b = _ctrl.text.trim();
    if (b.isEmpty) return;
    await widget.store.addBrand(b);
    _ctrl.clear();
    setState(() {});
  }
  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final suggestions = {...ProductClassifier.priorityBrands, ...ProductClassifier.secondaryBrands}.toList()..sort();
    return Column(children: [
      Padding(padding: const EdgeInsets.all(8), child: TextField(
        controller: _ctrl,
        decoration: InputDecoration(hintText: 'Add a brand (e.g. HOCHIKI)', suffixIcon: IconButton(icon: const Icon(Icons.add), onPressed: _add)),
        onSubmitted: (_) => _add(),
      )),
      Expanded(child: ListView(children: [
        if (widget.store.brands.isNotEmpty) ...[...widget.store.brands.map((b) => ListTile(
          title: Text(b),
          trailing: IconButton(icon: const Icon(Icons.delete_outline), onPressed: () async { await widget.store.removeBrand(b); setState(() {}); }),
        )), const Divider(),
        const Padding(padding: EdgeInsets.all(8), child: Text('Known brands (tap to add)', style: TextStyle(fontWeight: FontWeight.bold))),
        ...suggestions.map((b) => ListTile(
          dense: true,
          title: Text(b),
          trailing: widget.store.brands.contains(b)
              ? const Icon(Icons.check, color: Colors.green)
              : IconButton(icon: const Icon(Icons.add), onPressed: () async { await widget.store.addBrand(b); setState(() {}); }),
        )),
      ]])),
    ]);
  }
}

class _CategoriesTab extends StatefulWidget {
  final TaxonomyStore store;
  const _CategoriesTab({required this.store});
  @override
  State<_CategoriesTab> createState() => _CategoriesTabState();
}

class _CategoriesTabState extends State<_CategoriesTab> {
  String _parentId = '';
  final _ctrl = TextEditingController();
  Future<void> _add() async {
    final n = _ctrl.text.trim();
    if (n.isEmpty) return;
    await widget.store.addNode(_parentId, n);
    _ctrl.clear();
    setState(() {});
  }
  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final path = _parentId.isEmpty ? 'Root' : widget.store.pathOf(_parentId).join(' > ');
    final children = _parentId.isEmpty ? widget.store.roots : widget.store.childrenOf(_parentId);
    return Column(children: [
      Padding(padding: const EdgeInsets.all(8), child: Card(child: ListTile(
        title: Text('Current: $path'),
        subtitle: const Text('Tap a category to go into it'),
        trailing: _parentId.isEmpty ? null : IconButton(icon: const Icon(Icons.arrow_upward), onPressed: () {
          final parent = widget.store.nodes.where((n) => n['id'] == _parentId).toList();
          setState(() { _parentId = parent.isNotEmpty ? (parent.first['parent'] as String) : ''; });
        }),
      ))),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: TextField(
        controller: _ctrl,
        decoration: InputDecoration(hintText: 'Add a new sub-category', suffixIcon: IconButton(icon: const Icon(Icons.add), onPressed: _add)),
        onSubmitted: (_) => _add(),
      )),
      const SizedBox(height: 8),
      Expanded(child: children.isEmpty
        ? const Center(child: Text('No sub-categories yet'))
        : ListView.builder(itemCount: children.length, itemBuilder: (ctx, i) {
            final node = children[i];
            return ListTile(
              leading: const Icon(Icons.folder),
              title: Text(node['name'] as String),
              trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                IconButton(icon: const Icon(Icons.subdirectory_arrow_right), tooltip: 'Open', onPressed: () => setState(() => _parentId = node['id'] as String)),
                IconButton(icon: const Icon(Icons.delete_outline), onPressed: () async { await widget.store.removeNode(node['id'] as String); setState(() {}); }),
              ]),
            );
          })),
    ]);
  }
}

class _ProductsTab extends StatefulWidget {
  final TaxonomyStore store;
  const _ProductsTab({required this.store});
  @override
  State<_ProductsTab> createState() => _ProductsTabState();
}

class _ProductsTabState extends State<_ProductsTab> {
  String _ref = '';
  final _refCtrl = TextEditingController();
  final _brandCtrl = TextEditingController();
  Future<void> _save() async {
    await widget.store.setOverride(_ref, brand: _brandCtrl.text.trim());
    setState(() {});
  }
  @override
  void dispose() { _refCtrl.dispose(); _brandCtrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(padding: const EdgeInsets.all(8), child: TextField(
        controller: _refCtrl,
        decoration: const InputDecoration(hintText: 'Product reference (e.g. 1412170-23)'),
        onChanged: (v) => setState(() => _ref = v.trim()),
      )),
      Padding(padding: const EdgeInsets.symmetric(horizontal: 8), child: TextField(
        controller: _brandCtrl,
        decoration: InputDecoration(hintText: 'Assign brand', suffixIcon: _ref.isEmpty ? null : IconButton(icon: const Icon(Icons.check), onPressed: _save)),
        onSubmitted: (_) => _save(),
      )),
      const Padding(padding: EdgeInsets.all(8), child: Text('Enter a reference, set its brand, then save.')),
    ]);
  }
}
