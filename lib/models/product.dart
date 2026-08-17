class Product {
  final String ref;
  final String name;
  final double qty;
  final String family;
  final String sub1;
  final String sub2;
  final String sub3;
  final String supplier;
  final List<String> alternatives;

  const Product({
    required this.ref,
    required this.name,
    required this.qty,
    required this.family,
    required this.sub1,
    required this.sub2,
    required this.sub3,
    required this.supplier,
    this.alternatives = const [],
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      ref: json['ref'] as String? ?? '',
      name: json['name'] as String? ?? '',
      qty: (json['qty'] as num?)?.toDouble() ?? 0,
      family: json['family'] as String? ?? '',
      sub1: json['sub1'] as String? ?? '',
      sub2: json['sub2'] as String? ?? '',
      sub3: json['sub3'] as String? ?? '',
      supplier: json['supplier'] as String? ?? '',
      alternatives: (json['alternatives'] as List?)?.cast<String>() ?? const [],
    );
  }

  Map<String, dynamic> toJson() => {
        'ref': ref,
        'name': name,
        'qty': qty,
        'family': family,
        'sub1': sub1,
        'sub2': sub2,
        'sub3': sub3,
        'supplier': supplier,
        'alternatives': alternatives,
      };

  String get displayName => name.isEmpty ? ref : name;
}