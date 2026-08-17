import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../data/catalog_loader.dart';
import '../main.dart';
import 'catalog_screen.dart';
import 'count_screen.dart';
import 'sessions_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(
        title: const Text('ST3S Inventory'),
        backgroundColor: Colors.red.shade700,
        foregroundColor: Colors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // User info card
            Card(
              child: ListTile(
                leading: const Icon(Icons.person, size: 40),
                title: Text(
                  appState.userName.isEmpty ? 'Set your name' : appState.userName,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: Text(
                  appState.lastDepot.isEmpty
                      ? 'No depot selected'
                      : 'Depot: ${appState.lastDepot}',
                ),
                trailing: const Icon(Icons.edit),
                onTap: () => _showSetupDialog(context),
              ),
            ),
            const SizedBox(height: 16),
            // Main action buttons
            _ActionCard(
              icon: Icons.qr_code_scanner,
              title: 'Count Mode',
              subtitle: 'Scan barcodes or use camera OCR',
              color: Colors.red.shade700,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CountScreen()),
              ),
            ),
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.inventory_2,
              title: 'Product Catalog',
              subtitle: 'Browse ${CatalogLoader.products.length} products',
              color: Colors.blue.shade700,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const CatalogScreen()),
              ),
            ),
            const SizedBox(height: 12),
            _ActionCard(
              icon: Icons.history,
              title: 'Count Sessions',
              subtitle: 'View, export and merge counts',
              color: Colors.green.shade700,
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const SessionsScreen()),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showSetupDialog(BuildContext context) {
    final appState = context.read<AppState>();
    final nameCtrl = TextEditingController(text: appState.userName);
    final depotCtrl = TextEditingController(text: appState.lastDepot);

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Setup'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: 'Your name'),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: depotCtrl,
              decoration: const InputDecoration(labelText: 'Depot name'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              appState.userName = nameCtrl.text.trim();
              appState.lastDepot = depotCtrl.text.trim();
              Navigator.pop(ctx);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: CircleAvatar(
          backgroundColor: color,
          child: Icon(icon, color: Colors.white),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}