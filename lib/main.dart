import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'data/catalog_loader.dart';
import 'storage/session_store.dart';
import 'storage/taxonomy_store.dart';
import 'ui/home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final store = SessionStore();
  await store.init();
  final taxonomy = TaxonomyStore();
  await taxonomy.init();
  await CatalogLoader.load();
  runApp(InventoryApp(store: store, taxonomy: taxonomy));
}

class InventoryApp extends StatelessWidget {
  final SessionStore store;
  final TaxonomyStore taxonomy;
  const InventoryApp({super.key, required this.store, required this.taxonomy});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<SessionStore>.value(value: store),
        Provider<TaxonomyStore>.value(value: taxonomy),
        ChangeNotifierProvider(create: (_) => AppState(store)),
      ],
      child: MaterialApp(
        title: 'ST3S Inventory',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.red.shade700),
          useMaterial3: true,
        ),
        home: const HomeScreen(),
      ),
    );
  }
}

class AppState extends ChangeNotifier {
  final SessionStore store;
  AppState(this.store);

  String get userName => store.userName;
  set userName(String v) {
    store.userName = v;
    notifyListeners();
  }

  String get lastDepot => store.lastDepot;
  set lastDepot(String v) {
    store.lastDepot = v;
    notifyListeners();
  }
}