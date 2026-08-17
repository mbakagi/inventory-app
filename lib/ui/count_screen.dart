import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../data/catalog_loader.dart';
import '../main.dart';
import '../models/count_session.dart';
import '../models/product.dart';
import '../storage/session_store.dart';

class CountScreen extends StatefulWidget {
  const CountScreen({super.key});

  @override
  State<CountScreen> createState() => _CountScreenState();
}

class _CountScreenState extends State<CountScreen> {
  final _searchCtrl = TextEditingController();
  final _entries = <String, CountEntry>{};
  bool _scanning = false;
  String _lastScanned = '';
  Timer? _debounce;
  final _scannerController = MobileScannerController();
  final _textRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
  final _imagePicker = ImagePicker();
  bool _processingOcr = false;
  List<Product> _suggestions = [];
  bool _showSuggestions = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    _debounce?.cancel();
    _scannerController.dispose();
    _textRecognizer.close();
    super.dispose();
  }

  void _addProduct(Product p) {
    setState(() {
      final existing = _entries[p.ref];
      if (existing != null) {
        existing.count++;
      } else {
        _entries[p.ref] = CountEntry(ref: p.ref, name: p.name, count: 1);
      }
      _lastScanned = p.ref;
    });
  }

  void _onBarcodeDetected(BarcodeCapture capture) {
    final code = capture.barcodes.isNotEmpty ? capture.barcodes.first.rawValue : null;
    if (code == null || code.isEmpty) return;
    final product = CatalogLoader.findByRef(code);
    if (product != null) {
      _addProduct(product);
    } else {
      // Try fuzzy match
      final matches = CatalogLoader.fuzzyMatch(code, limit: 1);
      if (matches.isNotEmpty) {
        _addProduct(matches.first.$1);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Not found: $code')),
        );
      }
    }
  }

  /// Take a photo and run OCR to find product references in the image.
  Future<void> _captureAndOcr() async {
    if (_processingOcr) return;
    setState(() => _processingOcr = true);
    try {
      final photo = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1920,
        maxHeight: 1080,
        imageQuality: 80,
      );
      if (photo == null) {
        if (mounted) setState(() => _processingOcr = false);
        return;
      }
      final inputImage = InputImage.fromFilePath(photo.path);
      final recognizedText = await _textRecognizer.processImage(inputImage);
      var found = false;
      for (final block in recognizedText.blocks) {
        for (final line in block.lines) {
          final text = line.text.trim();
          if (text.isEmpty) continue;
          // Try exact ref match first
          final product = CatalogLoader.findByRef(text);
          if (product != null) {
            _addProduct(product);
            found = true;
            break;
          }
          // Try fuzzy match on each word
          for (final word in text.split(RegExp(r'[\s,;:]+'))) {
            if (word.length < 3) continue;
            final matches = CatalogLoader.fuzzyMatch(word, limit: 1);
            if (matches.isNotEmpty && matches.first.$2 >= 80) {
              _addProduct(matches.first.$1);
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
      if (!found && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('No product reference found in image')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('OCR error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _processingOcr = false);
    }
  }

  void _pickProduct(Product p) {
    _addProduct(p);
    _searchCtrl.clear();
    setState(() {
      _suggestions = [];
      _showSuggestions = false;
    });
  }

  void _onSearchChanged(String query) {
    _debounce?.cancel();
    if (query.trim().isEmpty) {
      setState(() {
        _suggestions = [];
        _showSuggestions = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () {
      final matches = CatalogLoader.fuzzyMatch(query, limit: 6);
      if (!mounted) return;
      setState(() {
        _suggestions = matches.map((m) => m.$1).toList();
        _showSuggestions = true;
      });
    });
  }

  void _onSearchSubmitted(String query) {
    final exact = CatalogLoader.findByRef(query.trim());
    if (exact != null) {
      _pickProduct(exact);
      return;
    }
    if (_suggestions.isNotEmpty) {
      _pickProduct(_suggestions.first);
    }
  }

  Future<void> _saveSession() async {
    final appState = context.read<AppState>();
    if (_entries.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No items counted yet')),
      );
      return;
    }
    final store = context.read<SessionStore>();
    final session = CountSession(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      depot: appState.lastDepot.isEmpty ? 'Unknown' : appState.lastDepot,
      user: appState.userName.isEmpty ? 'Unknown' : appState.userName,
      createdAt: DateTime.now(),
      entries: _entries.values.toList(),
    );
    await store.saveSession(session);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Session saved!')),
    );
    setState(() => _entries.clear());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Count Mode'),
        backgroundColor: Colors.red.shade700,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'Toggle scanner',
            onPressed: () => setState(() => _scanning = !_scanning),
          ),
          IconButton(
            icon: const Icon(Icons.save),
            tooltip: 'Save session',
            onPressed: _saveSession,
          ),
        ],
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.all(8),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Type reference or name...',
                prefixIcon: const Icon(Icons.search),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onChanged: _onSearchChanged,
              onSubmitted: _onSearchSubmitted,
            ),
          ),
          // Suggestions (live list)
          if (_showSuggestions && _suggestions.isNotEmpty)
            Container(
              constraints: const BoxConstraints(maxHeight: 220),
              margin: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(color: Colors.black26, blurRadius: 6, offset: Offset(0, 2)),
                ],
              ),
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: _suggestions.length,
                itemBuilder: (ctx, i) {
                  final p = _suggestions[i];
                  return ListTile(
                    dense: true,
                    leading: const Icon(Icons.add_box_outlined, color: Colors.red),
                    title: Text(p.ref, style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text(p.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                    onTap: () => _pickProduct(p),
                  );
                },
              ),
            ),
          // Scanner
          if (_scanning)
            SizedBox(
              height: 200,
              child: MobileScanner(
                controller: _scannerController,
                onDetect: _onBarcodeDetected,
                errorBuilder: (context, error) => Center(
                  child: Text('Scanner error: $error'),
                ),
              ),
            ),
          // OCR button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: _processingOcr
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.text_fields),
                    label: Text(_processingOcr ? 'Processing...' : 'OCR Photo'),
                    onPressed: _processingOcr ? null : _captureAndOcr,
                  ),
                ),
              ],
            ),
          ),
          // Last scanned
          if (_lastScanned.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(8),
              child: Text(
                'Last: $_lastScanned',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
              ),
            ),
          // Count summary
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('${_entries.length} items', style: Theme.of(context).textTheme.titleMedium),
                Text(
                  '${_entries.values.fold(0, (s, e) => s + e.count)} total',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
          ),
          const Divider(),
          // Entries list
          Expanded(
            child: _entries.isEmpty
                ? const Center(
                    child: Text('Scan or search to start counting'),
                  )
                : ListView.builder(
                    itemCount: _entries.length,
                    itemBuilder: (ctx, i) {
                      final entry = _entries.values.toList()[i];
                      return ListTile(
                        title: Text(entry.ref, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(entry.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove_circle_outline),
                              onPressed: () => setState(() {
                                if (entry.count > 0) entry.count--;
                                if (entry.count == 0) _entries.remove(entry.ref);
                              }),
                            ),
                            SizedBox(
                              width: 40,
                              child: Text(
                                '${entry.count}',
                                textAlign: TextAlign.center,
                                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.add_circle_outline),
                              onPressed: () => setState(() => entry.count++),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}