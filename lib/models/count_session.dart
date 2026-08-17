class CountEntry {
  final String ref;
  final String name;
  int count;
  final DateTime timestamp;

  CountEntry({
    required this.ref,
    required this.name,
    this.count = 0,
    DateTime? timestamp,
  }) : timestamp = timestamp ?? DateTime.now();

  Map<String, dynamic> toJson() => {
        'ref': ref,
        'name': name,
        'count': count,
        'timestamp': timestamp.toIso8601String(),
      };

  factory CountEntry.fromJson(Map<String, dynamic> json) => CountEntry(
        ref: json['ref'] as String? ?? '',
        name: json['name'] as String? ?? '',
        count: (json['count'] as num?)?.toInt() ?? 0,
        timestamp: DateTime.tryParse(json['timestamp'] as String? ?? '') ?? DateTime.now(),
      );
}

class CountSession {
  final String id;
  final String depot;
  final String user;
  final DateTime createdAt;
  final List<CountEntry> entries;

  CountSession({
    required this.id,
    required this.depot,
    required this.user,
    required this.createdAt,
    this.entries = const [],
  });

  int get totalItems => entries.length;
  int get totalCounted => entries.fold(0, (sum, e) => sum + e.count);

  Map<String, dynamic> toJson() => {
        'id': id,
        'depot': depot,
        'user': user,
        'createdAt': createdAt.toIso8601String(),
        'entries': entries.map((e) => e.toJson()).toList(),
      };

  factory CountSession.fromJson(Map<String, dynamic> json) => CountSession(
        id: json['id'] as String? ?? '',
        depot: json['depot'] as String? ?? '',
        user: json['user'] as String? ?? '',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
        entries: (json['entries'] as List? ?? [])
            .map((e) => CountEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}