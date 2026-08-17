import '../models/product.dart';
import '../storage/taxonomy_store.dart';

/// Classification engine that analyzes a product's reference and name to
/// determine its brand and a human-readable category path.
///
/// Brand detection uses word-boundary matching so short tokens don't create
/// false positives (e.g. "CAME" is not matched inside "CAMERA").
class ProductClassifier {
  /// Priority brands identified by the business. Word-boundary matched.
  static const priorityBrands = <String>[
    'HOCHIKI', 'PULSAR', 'FINSECUR', 'SYCHRONIC', 'INIM', 'MATRIX', 'NUMENS',
    'TRIKDIS', 'KLAXON', 'SOCA', 'SYNAPS', 'ELFRI', 'PROSENSE',
  ];

  /// Secondary brands commonly present in the catalog.
  static const secondaryBrands = <String>[
    'DAHUA', 'HIKVISION', 'PYRONIX', 'MIFARE', 'LEGRAND', 'HID', 'APOLLO',
    'BENTEL', 'ELKRON', 'TP-LINK', 'DSC', 'VISONIC', 'RISCO', 'EATON',
    'SATEL', 'GENT', 'NOTIFIER', 'ESSER', 'FIRECLASS', 'TELEVES', 'IKUSI',
    'FRACARRO', 'KENTEC', 'C-TEC', 'KIDDE', 'ZKTECO', 'AJAX', 'PARADOX',
    'COMELIT', 'FERMAX', 'AIPHONE', 'URMET', 'SOMFY', 'CAME', 'FAAC', 'BFT',
    'NICE', 'DORMA', 'GEZE', 'HONEYWELL', 'TYCO', 'VIVOTEK', 'HANWHA',
    'UNV', 'AXIS', 'SYNOLOGY', 'QNAP', 'SEAGATE', 'YEALINK', 'GRANDSTREAM',
    'PANASONIC', 'CISCO', 'UBIQUITI', 'MIKROTIK', 'NETGEAR', 'HUAWEI',
    'PHILIPS', 'OSRAM', 'MEAN WELL', 'TRIAX', 'XPR', 'OPTEX', 'TAKEX',
    'SICURIT', 'BENTEL', 'TECNOALARM', 'VIMAR', 'BTICINO', 'DELTA DORE',
  ];

  /// Map Excel family codes to readable names.
  static const familyLookup = <String, String>{
    'INCEN': 'Incendie',
    'VIDEO': 'Vidéosurveillance',
    'RESAU': 'Réseau',
    'INTRU': 'Intrusion',
    'CONTR': 'Contrôle d\'accès',
    'AC-CA': 'Badges & Cartes',
    'PO-AU': 'Fournitures',
    'CABLE': 'Câbles',
    'SERV': 'Services',
    'TECH': 'Technique',
    'INT': 'Interphonie',
    'INTER': 'Interphonie',
    'SONO': 'Sonorisation',
  };

  /// Ordered rules: name keyword -> {main category, sub category, sub-sub}.
  /// First matching rule wins. Fall back to the Excel family code.
  static final List<(List<String>, List<String>)> keywordRules = [
    // Fire / Incendie
    (['CENTRALE INCENDIE', 'CENTRALE DE DETECTION', 'CENTRALE DETECTION',
      'CONTROLEUR INCENDIE', 'COMPACT PANEL', 'PANEL INCENDIE'],
     ['Incendie', 'Centrales']),
    (['DETECTEUR OPTIQUE DE FUMEE', 'DETECTEUR DE FUMEE OPTIQUE', 'DETECTEUR OPTIQUE',
      'DETECTEUR DE FUMEE', 'DETECTEUR FUMEE', 'SMOKE DETECTOR', 'PHOTOELECTRIC'],
     ['Incendie', 'Détection', 'Détecteur de fumée']),
    (['DETECTEUR DE CHALEUR', 'DETECTEUR CHALEUR', 'HEAT DETECTOR'],
     ['Incendie', 'Détection', 'Détecteur de chaleur']),
    (['DETECTEUR LINEAIRE', 'DETECTEUR DE FLAMME', 'DETECTEUR FLAMME', 'DETECTEUR GAZ',
      'DETECTEUR DE GAZ', 'DETECTEUR MULTICRITERE', 'DETECTEUR CO', 'DETECTEUR DE CO'],
     ['Incendie', 'Détection', 'Détecteurs spéciaux']),
    (['DETECTEUR ADRESSABLE', 'DETECTEUR ADRES', 'SENSOR ADRESSABLE'],
     ['Incendie', 'Détection', 'Détecteur adressable']),
    (['DETECTEUR CONVENTIONNEL', 'DETECTEUR CONV'],
     ['Incendie', 'Détection', 'Détecteur conventionnel']),
    (['DETECTEUR', 'ALN-E', 'ALN-V', 'ALN-S'],
     ['Incendie', 'Détection']),
    (['DECLENCHEUR MANUEL', 'DECLENCHEUR', 'MANUAL CALL', 'MCP'],
     ['Incendie', 'Déclencheurs manuels']),
    (['SIRENE', 'AVERTISSEUR SONORE ET LUMINEUX', 'AVERTISSEUR LUMINEUX',
      'AVERTISSEUR SONORE', 'AVERTISSEUR', 'SONNERIE', 'BUZZER', 'HORN',
      'FLASHER', 'BALISE LUMINEUSE', 'BALISE'],
     ['Incendie', 'Signalisation', 'Avertisseurs']),
    (['INDICATEUR D\'ACTION', 'INDICATEUR', 'ALIMENTATION SIRENE', 'BATTERIE DE SECOURS SIRE'],
     ['Incendie', 'Signalisation']),
    (['SOCLE', 'BASE DETECTEUR', 'YBN-R', 'MBB-2', 'SBB-2'],
     ['Incendie', 'Accessoires', 'Socles']),
    (['ISOLATEUR', 'MODULE ISOLATEUR', 'MONITORAGE', 'MODULE'],
     ['Incendie', 'Modules']),
    (['BOITIER ETANCHE', 'BOITIER', 'COFFRET', 'PROTECTION'],
     ['Incendie', 'Accessoires', 'Boîtiers']),
    (['ADRESSEUR', 'ETIQUETTE', 'PLAQUE', 'SUPPORT'],
     ['Incendie', 'Accessoires']),
    // Video / CCTV
    (['CAMERA IP', 'CAMERA RESEAU', 'IP CAM', 'CAM IP'],
     ['Vidéosurveillance', 'Caméras', 'IP']),
    (['CAMERA AHD', 'CAM AHD'],
     ['Vidéosurveillance', 'Caméras', 'AHD']),
    (['CAMERA ANALOG', 'CAM ANALOG', 'CAMERA ANALOGIQUE', 'CAMERA TVI', 'CAMERA HD-SDI'],
     ['Vidéosurveillance', 'Caméras', 'Analogique']),
    (['DOMO', 'CAMERA DOMO', 'DOME'],
     ['Vidéosurveillance', 'Caméras', 'Dôme']),
    (['BULLET', 'CAMERA BULLET', 'CAMERA FIXE'],
     ['Vidéosurveillance', 'Caméras', 'Fixe']),
    (['CAMERA', 'CAM', 'VIDEO SURVEILLANCE'],
     ['Vidéosurveillance', 'Caméras']),
    (['NVR', 'ENREGISTREUR', 'DVR', 'HVR', 'XVR'],
     ['Vidéosurveillance', 'Enregistreurs']),
    (['OBJECTIF', 'LENTILLE', 'LENS', 'CABLE VIDEO'],
     ['Vidéosurveillance', 'Accessoires']),
    (['MONITEUR', 'ECRAN', 'AFFICHEUR VIDEO', 'MONITORING'],
     ['Vidéosurveillance', 'Moniteurs']),
    // Networking / Réseau
    (['SWITCH', 'COMMUTATEUR', 'ROUTEUR', 'ROUTER', 'MODEM', 'POINT D\'ACCES',
      'ACCESS POINT', 'PASSERELLE', 'GATEWAY'],
     ['Réseau', 'Équipements actifs']),
    (['PATCHCORD', 'CORDE DE BRASSAGE', 'FIBRE OPTIQUE', 'PRISE RJ45', 'PRISE RESEAU',
      'MODULE RJ45', 'CONNECTEUR RJ45', 'RACK', 'BAIE', 'REPARTITEUR', 'GBT'],
     ['Réseau', 'Câblage']),
    (['CABLE RESEAU', 'CABLE UTP', 'CABLE F/UTP', 'CAT 6', 'CAT 5', 'CABLE RJ45'],
     ['Réseau', 'Câbles']),
    (['TUBE', 'GOULOTTE', 'CHEMIN DE CABLE'],
     ['Réseau', 'Accessoires']),
    // Access control
    (['POINTEUSE', 'CONTROLEUR DE PRESENCE', 'POINTEUSE A EMPREINTE',
      'BIOMETRIQUE', 'BIOMETRIC', 'EMPLOYEE', 'TIME ATTENDANCE'],
     ['Contrôle d\'accès', 'Pointage / Présence']),
    (['CONTROLLEUR', 'CONTROLEUR D\'ACCES', 'CONTROLLER ACCESS', 'MOLEX',
      'CONTROLEUR 2 LECTEURS', 'UNITE CENTRALE ACCES'],
     ['Contrôle d\'accès', 'Contrôleurs']),
    (['LECTEUR', 'READER', 'LECTEUR DE PROXIMITE', 'LECTEUR EMPREINTE'],
     ['Contrôle d\'accès', 'Lecteurs']),
    (['VENTOUZE', 'GACHETTE', 'GACHE', 'GACHET ELECTRIQUE', 'EM LOCK', 'MAGNETIQUE LOCK'],
     ['Contrôle d\'accès', 'Serrures / Ventouses']),
    (['CLAVIER', 'KEYPAD', 'BADGEUSE', 'PUPITRE'],
     ['Contrôle d\'accès', 'Claviers']),
    (['PORTE BADGE', 'BADGE PORTE', 'ARMORE', 'BRAS', 'POIGNEES', 'BAUDRIC'],
     ['Contrôle d\'accès', 'Accessoires']),
    // Cards / Badges
    (['CARTE DE PROXIMITE', 'CARTE RFID', 'CARTE 125 KHZ', 'CARTE 13.56',
      'CARTE MIFARE', 'CARTE HID', 'CARTE BLANCHE', 'CARTE ISO', 'PVC',
      'PORTE BADGE', 'BADGE', 'CARTE VOCAL', 'CARTE VOCALE'],
     ['Badges & Cartes', 'Cartes']),
    (['RUBAN', 'RAVOIR', 'ETIQUETTE', 'BADGES'],
     ['Badges & Cartes', 'Consommables']),
    // Intrusion
    (['CENTRALE D\'ALARME', 'CENTRALE ALARME', 'CENTRALE INTRUSION',
      'ALARM CENTRAL', 'CENTRALE D\'INTRUSION'],
     ['Intrusion', 'Centrales']),
    (['DETECTEUR INTRUSION', 'DETECTEUR DE MOUVEMENT', 'DETECTEUR MOVEMENT',
      'DETECTEUR VOLUMETRIQUE', 'DETECTEUR IR', 'CAPTEUR PIR', 'PIR',
      'DETECTEUR MAGNETIQUE', 'CONTACT MAGNETIQUE', 'DETECTEUR VIBRATION',
      'DETECTEUR DE RUPTURE', 'DETECTEUR DE VITRE'],
     ['Intrusion', 'Détecteurs']),
    (['CLAVIER INTRUSION', 'CLAVIER ALARME', 'TELECOMMANDE', 'EMETTEUR'],
     ['Intrusion', 'Commandes']),
    (['SIRENE INTRUSION', 'SIRENE INTERIEURE', 'SIRENE EXTERIEURE', 'SIRENE SANS FIL'],
     ['Intrusion', 'Sirènes']),
    (['SONDE', 'CAPTEUR TEMPERATURE', 'SONDE TEMPERATURE', 'DETECTEUR DE GAZ INTRUS'],
     ['Intrusion', 'Capteurs']),
    // Intercom / Interphonie
    (['INTERPHONE', 'INTERCOM', 'VISIOPHONE', 'KIT SONNERIE', 'PLATINE DE RUE',
      'POSTE INTERPHONE', 'AUDIO PHONE'],
     ['Interphonie', 'Postes']),
    (['GACHE INTERPHONE', 'ALIMENTATION INTERPHONE', 'KIT INTERPHONE'],
     ['Interphonie', 'Accessoires']),
    // Cables
    (['CABLE', 'FIL', 'GAINE', 'CORDON', 'LIAISON'],
     ['Câbles', 'Câblage']),
    (['BATTERIE', 'PILE', 'ACCU', 'PILE DE SECOURS'],
     ['Fournitures', 'Batteries']),
    (['ALIMENTATION', 'TRANSFORMATEUR', 'ALIM', 'CHARGEUR'],
     ['Fournitures', 'Alimentations']),
    (['VIS', 'BOUCHON', 'ECROU', 'GOULOTTE', 'COLLIER', 'MANCHON', 'DOMINO'],
     ['Fournitures', 'Petit matériel']),
    (['CAMERA DE RECUL', 'HARNAS', 'PASS', 'CARNET', 'CHEQUES', 'ENVELOPPE'],
     ['Fournitures', 'Consommables']),
  ];

  /// Returns the detected brand for a product, or '' if unknown.
  static String detectBrand(String name, String ref) {
    final text = '$name $ref'.toUpperCase();
    for (final b in priorityBrands) {
      if (_containsWord(text, b)) return b;
    }
    for (final b in secondaryBrands) {
      if (_containsWord(text, b)) return b;
    }
    return '';
  }

  /// Returns the readable family name from the Excel family code.
  static String readableFamily(String familyCode) {
    final f = familyCode.trim().toUpperCase();
    if (f.isEmpty) return '';
    return familyLookup[f] ?? familyCode;
  }

  /// Returns a category path [main, sub, subSub] by analyzing keywords.
  static List<String> categorize(String name, String ref, String familyCode) {
    final combined = '$name $ref'.toUpperCase();
    for (final (keywords, path) in keywordRules) {
      for (final kw in keywords) {
        if (combined.contains(kw)) {
          // Return path + extra level (3 levels maximum)
          final full = <String>[...path];
          while (full.length < 3) {
            full.add('');
          }
          return full.take(3).toList();
        }
      }
    }
    // Fallback: use readable family as level 1
    final fam = readableFamily(familyCode);
    if (fam.isEmpty) return ['', '', ''];
    return [fam, '', ''];
  }

  /// Combines classification results with any user override from the taxonomy
  /// store. Returns [brand, family, sub1, sub2, sub3].
  static List<String> classify(Product p, TaxonomyStore taxonomy) {
    final override = taxonomy.overrideFor(p.ref);
    final categories = categorize(p.name, p.ref, p.family);

    String brand = detectBrand(p.name, p.ref);
    if (brand.isEmpty && p.supplier.isNotEmpty) brand = p.supplier;
    String family = readableFamily(p.family);

    return [
      override?['brand']?.toString().isNotEmpty == true
          ? override!['brand'].toString()
          : brand,
      override?['family']?.toString().isNotEmpty == true
          ? override!['family'].toString()
          : family,
      override?['sub1']?.toString().isNotEmpty == true
          ? override!['sub1'].toString()
          : categories[0],
      override?['sub2']?.toString().isNotEmpty == true
          ? override!['sub2'].toString()
          : categories[1],
      override?['sub3']?.toString().isNotEmpty == true
          ? override!['sub3'].toString()
          : categories[2],
    ];
  }

  static bool _containsWord(String text, String word) {
    final upperWord = word.toUpperCase();
    final lowerText = text.toUpperCase();
    int from = 0;
    while (true) {
      final idx = lowerText.indexOf(upperWord, from);
      if (idx == -1) return false;
      final before = idx == 0 ? '' : lowerText[idx - 1];
      final afterEnd = idx + upperWord.length;
      final after = afterEnd >= lowerText.length ? '' : lowerText[afterEnd];
      // Word boundary: before/after must be non-alphanumeric
      if (!RegExp(r'[A-Z0-9]').hasMatch(before) && !RegExp(r'[A-Z0-9]').hasMatch(after)) {
        return true;
      }
      from = afterEnd;
    }
  }
}