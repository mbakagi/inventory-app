import 'dart:io';
import 'package:excel/excel.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../models/count_session.dart';
import '../storage/session_store.dart';

class SessionsScreen extends StatefulWidget {
  const SessionsScreen({super.key});

  @override
  State<SessionsScreen> createState() => _SessionsScreenState();
}

class _SessionsScreenState extends State<SessionsScreen> {
  List<CountSession> _sessions = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() {
    final store = context.read<SessionStore>();
    _loadWith(store);
  }

  void _loadWith(SessionStore store) {
    setState(() => _sessions = store.getSessions());
  }

  Future<void> _exportSession(CountSession session) async {
    final excel = Excel.createExcel();
    final sheet = excel['Count'];

    // Headers
    sheet.appendRow([TextCellValue('Reference'), TextCellValue('Name'), TextCellValue('Count'), TextCellValue('Timestamp')]);
    for (final e in session.entries) {
      sheet.appendRow([
        TextCellValue(e.ref),
        TextCellValue(e.name),
        IntCellValue(e.count),
        TextCellValue(e.timestamp.toIso8601String()),
      ]);
    }

    final dir = await getApplicationDocumentsDirectory();
    final file = File('${dir.path}/count_${session.depot}_${session.createdAt.millisecondsSinceEpoch}.xlsx');
    await file.writeAsBytes(excel.encode()!);

    await Share.shareXFiles([XFile(file.path)], text: 'Count session: ${session.depot}');
  }

  Future<void> _importSession() async {
    final result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['xlsx']);
    if (result == null || result.files.single.path == null) return;

    final file = File(result.files.single.path!);
    final bytes = await file.readAsBytes();
    final excel = Excel.decodeBytes(bytes);
    final sheet = excel.tables.values.first;

    final entries = <CountEntry>[];
    for (var i = 1; i < sheet.rows.length; i++) {
      final row = sheet.rows[i];
      if (row.length < 3) continue;
      final ref = row[0]?.value?.toString() ?? '';
      final name = row[1]?.value?.toString() ?? '';
      final count = int.tryParse(row[2]?.value?.toString() ?? '0') ?? 0;
      if (ref.isNotEmpty) {
        entries.add(CountEntry(ref: ref, name: name, count: count));
      }
    }

    if (entries.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No valid entries found in file')),
      );
      return;
    }

    if (!mounted) return;
    final store = context.read<SessionStore>();
    final session = CountSession(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      depot: 'Imported',
      user: 'Import',
      createdAt: DateTime.now(),
      entries: entries,
    );
    await store.saveSession(session);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Imported ${entries.length} entries')),
    );
    _loadWith(store);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Count Sessions'),
        backgroundColor: Colors.green.shade700,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.file_download),
            tooltip: 'Import Excel',
            onPressed: _importSession,
          ),
        ],
      ),
      body: _sessions.isEmpty
          ? const Center(child: Text('No sessions yet'))
          : ListView.builder(
              itemCount: _sessions.length,
              itemBuilder: (ctx, i) {
                final s = _sessions[i];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.green.shade700,
                      child: Text('${s.totalItems}'),
                    ),
                    title: Text('${s.depot} - ${s.user}'),
                    subtitle: Text(
                      '${s.createdAt.toString().substring(0, 16)} | ${s.totalCounted} counted',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.share),
                          tooltip: 'Export Excel',
                          onPressed: () => _exportSession(s),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline),
                          tooltip: 'Delete',
                          onPressed: () async {
                            final store = context.read<SessionStore>();
                            await store.deleteSession(s.id);
                            _load();
                          },
                        ),
                      ],
                    ),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => SessionDetailScreen(session: s)),
                    ),
                  ),
                );
              },
            ),
    );
  }
}

class SessionDetailScreen extends StatelessWidget {
  final CountSession session;
  const SessionDetailScreen({super.key, required this.session});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('${session.depot} - ${session.user}'),
        backgroundColor: Colors.green.shade700,
        foregroundColor: Colors.white,
      ),
      body: ListView(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Created: ${session.createdAt}'),
                Text('Items: ${session.totalItems}'),
                Text('Total counted: ${session.totalCounted}'),
              ],
            ),
          ),
          const Divider(),
          ...session.entries.map((e) => ListTile(
                title: Text(e.ref, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text(e.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: Text('${e.count}', style: const TextStyle(fontSize: 18)),
              )),
        ],
      ),
    );
  }
}