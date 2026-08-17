import 'dart:convert';
import 'package:hive_flutter/hive_flutter.dart';
import '../models/count_session.dart';

class SessionStore {
  static const _boxName = 'count_sessions';
  static const _settingsBox = 'settings';
  late Box<String> _box;
  late Box<String> _settings;

  Future<void> init() async {
    await Hive.initFlutter();
    _box = await Hive.openBox<String>(_boxName);
    _settings = await Hive.openBox<String>(_settingsBox);
  }

  // --- Settings ---
  String get userName => _settings.get('user', defaultValue: '') ?? '';
  set userName(String v) => _settings.put('user', v);

  String get lastDepot => _settings.get('depot', defaultValue: '') ?? '';
  set lastDepot(String v) => _settings.put('depot', v);

  // --- Sessions ---
  List<CountSession> getSessions() {
    final sessions = <CountSession>[];
    for (final key in _box.keys) {
      final json = _box.get(key);
      if (json != null) {
        sessions.add(CountSession.fromJson(jsonDecode(json) as Map<String, dynamic>));
      }
    }
    sessions.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return sessions;
  }

  Future<void> saveSession(CountSession session) async {
    await _box.put(session.id, jsonEncode(session.toJson()));
  }

  Future<void> deleteSession(String id) async {
    await _box.delete(id);
  }

  Future<void> clearAll() async {
    await _box.clear();
  }
}