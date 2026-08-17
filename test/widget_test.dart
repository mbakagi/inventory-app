import 'package:flutter_test/flutter_test.dart';
import 'package:inventory_app/models/count_session.dart';
import 'package:inventory_app/models/product.dart';

void main() {
  group('Product', () {
    test('fromJson parses all fields', () {
      final p = Product.fromJson({
        'ref': 'TEST-REF',
        'name': 'Test Product',
        'qty': 42.5,
        'family': 'FAM',
        'sub1': 'S1',
        'sub2': 'S2',
        'sub3': 'S3',
        'supplier': 'SUP',
        'alternatives': ['ALT-1', 'ALT-2'],
      });

      expect(p.ref, 'TEST-REF');
      expect(p.name, 'Test Product');
      expect(p.qty, 42.5);
      expect(p.family, 'FAM');
      expect(p.sub1, 'S1');
      expect(p.sub2, 'S2');
      expect(p.sub3, 'S3');
      expect(p.supplier, 'SUP');
      expect(p.alternatives, ['ALT-1', 'ALT-2']);
    });

    test('fromJson handles missing fields with defaults', () {
      final p = Product.fromJson({});
      expect(p.ref, '');
      expect(p.name, '');
      expect(p.qty, 0);
      expect(p.family, '');
      expect(p.sub1, '');
      expect(p.sub2, '');
      expect(p.sub3, '');
      expect(p.supplier, '');
      expect(p.alternatives, isEmpty);
    });

    test('toJson round-trips', () {
      final p = Product(
        ref: 'R1',
        name: 'N1',
        qty: 10,
        family: 'F',
        sub1: 'S1',
        sub2: 'S2',
        sub3: 'S3',
        supplier: 'SUP',
        alternatives: ['A1'],
      );
      final json = p.toJson();
      final p2 = Product.fromJson(json);
      expect(p2.ref, p.ref);
      expect(p2.name, p.name);
      expect(p2.qty, p.qty);
      expect(p2.family, p.family);
      expect(p2.sub1, p.sub1);
      expect(p2.sub2, p.sub2);
      expect(p2.sub3, p.sub3);
      expect(p2.supplier, p.supplier);
      expect(p2.alternatives, p.alternatives);
    });

    test('displayName returns name when non-empty, else ref', () {
      expect(Product(ref: 'R', name: 'Name', qty: 0, family: '', sub1: '', sub2: '', sub3: '', supplier: '').displayName, 'Name');
      expect(Product(ref: 'R', name: '', qty: 0, family: '', sub1: '', sub2: '', sub3: '', supplier: '').displayName, 'R');
    });
  });

  group('CountEntry', () {
    test('toJson/fromJson round-trips', () {
      final e = CountEntry(ref: 'REF', name: 'Name', count: 5);
      final e2 = CountEntry.fromJson(e.toJson());
      expect(e2.ref, 'REF');
      expect(e2.name, 'Name');
      expect(e2.count, 5);
      expect(e2.timestamp, e.timestamp);
    });

    test('default count is 0 and timestamp is set', () {
      final e = CountEntry(ref: 'R', name: 'N');
      expect(e.count, 0);
      expect(e.timestamp, isNotNull);
    });
  });

  group('CountSession', () {
    test('totalItems and totalCounted', () {
      final s = CountSession(
        id: '1',
        depot: 'D',
        user: 'U',
        createdAt: DateTime(2024, 1, 1),
        entries: [
          CountEntry(ref: 'A', name: 'A', count: 2),
          CountEntry(ref: 'B', name: 'B', count: 3),
        ],
      );
      expect(s.totalItems, 2);
      expect(s.totalCounted, 5);
    });

    test('toJson/fromJson round-trips', () {
      final s = CountSession(
        id: '1',
        depot: 'D',
        user: 'U',
        createdAt: DateTime(2024, 1, 1, 12, 30),
        entries: [
          CountEntry(ref: 'A', name: 'A', count: 2),
          CountEntry(ref: 'B', name: 'B', count: 3),
        ],
      );
      final s2 = CountSession.fromJson(s.toJson());
      expect(s2.id, '1');
      expect(s2.depot, 'D');
      expect(s2.user, 'U');
      expect(s2.createdAt, DateTime(2024, 1, 1, 12, 30));
      expect(s2.entries.length, 2);
      expect(s2.entries[0].ref, 'A');
      expect(s2.entries[0].count, 2);
      expect(s2.entries[1].ref, 'B');
      expect(s2.entries[1].count, 3);
    });
  });
}