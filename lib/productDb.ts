/**
 * ฐานข้อมูลส่วนผสมของสินค้าสกินแคร์ยอดนิยม (ออฟไลน์)
 * ค้นด้วยชื่อแบรนด์/ชื่อสินค้า แล้วเติม INCI ให้อัตโนมัติ
 * ข้อมูลจากฉลากสินค้าจริง — อาจไม่ตรงกับสูตรใหม่ล่าสุด
 */

export interface ProductEntry {
  brand: string;
  name: string;
  inci: string;
}

export const PRODUCT_DB: ProductEntry[] = [
  // ── CeraVe ──
  { brand: "CeraVe", name: "Moisturizing Cream", inci: "Aqua, Glycerin, Cetearyl Alcohol, Caprylic/Capric Triglyceride, Cetyl Alcohol, Ceteareth-20, Petrolatum, Potassium Phosphate, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Dimethicone, Behentrimonium Methosulfate, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Cholesterol, Phenoxyethanol, Disodium EDTA, Dipotassium Phosphate, Tocopherol, Phytosphingosine, Xanthan Gum, Ethylhexylglycerin" },
  { brand: "CeraVe", name: "Hydrating Cleanser", inci: "Aqua, Glycerin, Cetearyl Alcohol, PEG-40 Stearate, Stearyl Alcohol, Cetyl Alcohol, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Sodium Lauroyl Lactylate, Sodium Hyaluronate, Cholesterol, Phytosphingosine, Behentrimonium Methosulfate, Potassium Phosphate, Dipotassium Phosphate, Sodium Hydroxide, Ethylhexylglycerin, Phenoxyethanol" },
  { brand: "CeraVe", name: "Foaming Cleanser", inci: "Aqua, Cocamidopropyl Hydroxysultaine, Glycerin, Sodium Lauroyl Sarcosinate, PEG-150 Pentaerythrityl Tetrastearate, Niacinamide, PEG-6 Caprylic/Capric Glycerides, Sodium Methyl Cocoyl Taurate, Propylene Glycol, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Sodium Chloride, Sodium Lauroyl Lactylate, Cholesterol, Phytosphingosine, Behentrimonium Methosulfate, Citric Acid, Sodium Hydroxide, Ethylhexylglycerin, Phenoxyethanol" },
  { brand: "CeraVe", name: "PM Facial Moisturizing Lotion", inci: "Aqua, Glycerin, Caprylic/Capric Triglyceride, Niacinamide, Cetearyl Alcohol, Phospholipids, Ceramide NP, Ceramide AP, Ceramide EOP, Carbomer, Dimethicone, Petrolatum, Polyglyceryl-3 Diisostearate, Cholesterol, Sodium Lauroyl Lactylate, Behentrimonium Methosulfate, Phenoxyethanol, Disodium EDTA, Tocopherol, Phytosphingosine, Sodium Hyaluronate, Xanthan Gum, Ethylhexylglycerin" },

  // ── The Ordinary ──
  { brand: "The Ordinary", name: "Niacinamide 10% + Zinc 1%", inci: "Aqua, Niacinamide, Pentylene Glycol, Zinc PCA, Dimethyl Isosorbide, Tamarindus Indica Seed Gum, Xanthan Gum, Isoceteth-20, Ethoxydiglycol, Phenoxyethanol, Chlorphenesin" },
  { brand: "The Ordinary", name: "Hyaluronic Acid 2% + B5", inci: "Aqua, Sodium Hyaluronate, Pentylene Glycol, Propanediol, Sodium Hyaluronate Crosspolymer, Panthenol, Ahnfeltia Concinna Extract, Glycerin, Trisodium Ethylenediamine Disuccinate, Citric Acid, Isoceteth-20, Ethoxydiglycol, Ethylhexylglycerin, Hexylene Glycol, 1,2-Hexanediol, Phenoxyethanol, Caprylyl Glycol" },
  { brand: "The Ordinary", name: "Retinol 0.5% in Squalane", inci: "Squalane, Caprylic/Capric Triglyceride, Retinol, Solanum Lycopersicum (Tomato) Fruit Extract, Simmondsia Chinensis (Jojoba) Seed Oil, BHT" },
  { brand: "The Ordinary", name: "AHA 30% + BHA 2% Peeling Solution", inci: "Glycolic Acid, Aqua, Aloe Barbadensis Leaf Water, Sodium Hydroxide, Daucus Carota Sativa Extract, Propanediol, Cocamidopropyl Dimethylamine, Salicylic Acid, Lactic Acid, Tartaric Acid, Citric Acid, Panthenol, Sodium Hyaluronate Crosspolymer, Tasmannia Lanceolata Fruit/Leaf Extract, Glycerin, Pentylene Glycol, Xanthan Gum, Polysorbate 20, Trisodium Ethylenediamine Disuccinate, Potassium Citrate, Ethylhexylglycerin, 1,2-Hexanediol, Caprylyl Glycol" },
  { brand: "The Ordinary", name: "Ascorbic Acid 8% + Alpha Arbutin 2%", inci: "Aqua, Ascorbic Acid, Propanediol, Alpha-Arbutin, Triethanolamine, Isodecyl Neopentanoate, Ethoxydiglycol, Aminomethyl Propanol, Glycerin, Dimethyl Isosorbide, Xanthan Gum, Polysorbate 20, Trisodium Ethylenediamine Disuccinate, Phenoxyethanol, Chlorphenesin" },
  { brand: "The Ordinary", name: "Salicylic Acid 2% Solution", inci: "Aqua, Cocamidopropyl Dimethylamine, Salicylic Acid, Polysorbate 20, Citric Acid, Phenoxyethanol, Chlorphenesin" },
  { brand: "The Ordinary", name: "Glycolic Acid 7% Toning Solution", inci: "Aqua, Glycolic Acid, Rosa Damascena Flower Water, Centaurea Cyanus Flower Water, Aloe Barbadensis Leaf Water, Propanediol, Glycerin, Triethanolamine, Aminomethyl Propanol, Panax Ginseng Root Extract, Tasmannia Lanceolata Fruit/Leaf Extract, Aspartic Acid, Alanine, Glycine, Serine, Valine, Isoleucine, Proline, Threonine, Histidine, Phenylalanine, Glutamic Acid, Arginine, PCA, Sodium PCA, Sodium Lactate, Polysorbate 20, Gellan Gum, Trisodium Ethylenediamine Disuccinate, Sodium Chloride, Hexylene Glycol, Potassium Sorbate, Sodium Benzoate, 1,2-Hexanediol, Caprylyl Glycol" },

  // ── La Roche-Posay ──
  { brand: "La Roche-Posay", name: "Effaclar Duo+", inci: "Aqua, Glycerin, Dimethicone, Isocetyl Stearate, Niacinamide, Isopropyl Lauroyl Sarcosinate, Silica, Ammonium Polyacryloyldimethyl Taurate, Zinc PCA, Myristyl Myristate, Salicylic Acid, Piroctone Olamine, Dimethiconol, Alumina, Poloxamer 338, Isohexadecane, Capryloyl Glycine, Caprylyl Glycol, Tocopherol, Disodium EDTA, Polysorbate 80, Sodium Hydroxide" },
  { brand: "La Roche-Posay", name: "Cicaplast Baume B5+", inci: "Aqua, Hydrogenated Polyisobutene, Dimethicone, Glycerin, Butyrospermum Parkii (Shea) Butter, Cetyl PEG/PPG-10/1 Dimethicone, Panthenol, Propanediol, Aluminum Starch Octenylsuccinate, Tristearin, Zinc Gluconate, Madecassoside, Manganese Gluconate, Copper Gluconate, Disodium EDTA, Acetylated Glycol Stearate, Polyglyceryl-4 Isostearate, Sodium Chloride, Tocopherol, Citric Acid" },

  // ── Eucerin ──
  { brand: "Eucerin", name: "Oil Control Sun Gel-Cream SPF50+", inci: "Aqua, Homosalate, Butyl Methoxydibenzoylmethane, Alcohol Denat., Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Ethylhexyl Triazone, C12-15 Alkyl Benzoate, Glycerin, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Ethylhexyl Salicylate, Silica, Phenylbenzimidazole Sulfonic Acid, Tapioca Starch, Potassium Cetyl Phosphate, Trisodium EDTA, Sodium Stearoyl Glutamate, Xanthan Gum, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Sodium Hydroxide, L-Carnitine, Glycyrrhetinic Acid" },

  // ── Biore ──
  { brand: "Biore", name: "UV Aqua Rich Watery Essence SPF50+", inci: "Water, Ethylhexyl Methoxycinnamate, Alcohol Denat., Lauryl Methacrylate/Sodium Methacrylate Crosspolymer, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Glycerin, Dimethicone, Dextrin Palmitate, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Agar, Arginine, BHT, Butylene Glycol, C12-14 Pareth-12, Disodium EDTA, Ethylhexylglycerin, Isopropyl Myristate, Sodium Hyaluronate, Xylitol" },

  // ── Cetaphil ──
  { brand: "Cetaphil", name: "Gentle Skin Cleanser", inci: "Aqua, Cetyl Alcohol, Propylene Glycol, Sodium Lauryl Sulfate, Stearyl Alcohol, Methylparaben, Propylparaben, Butylparaben" },
  { brand: "Cetaphil", name: "Moisturizing Lotion", inci: "Aqua, Glycerin, Hydrogenated Polyisobutene, Cetearyl Alcohol, Ceteareth-20, Macadamia Integrifolia Seed Oil, Dimethicone, Tocopheryl Acetate, Stearoxytrimethylsilane, Stearyl Alcohol, Panthenol, Niacinamide, Glyceryl Stearate, PEG-100 Stearate, Benzyl Alcohol, Phenoxyethanol, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Sodium Hydroxide, Citric Acid" },

  // ── Hada Labo ──
  { brand: "Hada Labo", name: "Gokujyun Hyaluronic Acid Lotion", inci: "Water, Butylene Glycol, Glycerin, Disodium Succinate, Hydrolyzed Hyaluronic Acid, Hydroxyethyl Urea, Methylparaben, PPG-10 Methyl Glucose Ether, Sodium Acetylated Hyaluronate, Sodium Hyaluronate, Succinic Acid" },
  { brand: "Hada Labo", name: "Shirojyun Premium Whitening Lotion", inci: "Water, Butylene Glycol, Glycerin, Hydroxyethyl Urea, Tranexamic Acid, Dipotassium Glycyrrhizate, Disodium Succinate, Hydrolyzed Hyaluronic Acid, Methylparaben, Sodium Acetylated Hyaluronate, Sodium Hyaluronate, Succinic Acid, Vinyl Dimethicone/Methicone Silsesquioxane Crosspolymer" },

  // ── Innisfree ──
  { brand: "Innisfree", name: "Green Tea Seed Serum", inci: "Water, Glycerin, Betaine, Dipropylene Glycol, 1,2-Hexanediol, Niacinamide, Camellia Sinensis Seed Oil, Camellia Sinensis Leaf Extract, Glyceryl Acrylate/Acrylic Acid Copolymer, Polyglutamic Acid, Trehalose, Betaine Salicylate, Ethylhexylglycerin, Xanthan Gum, Carbomer, Tromethamine, Disodium EDTA" },

  // ── COSRX ──
  { brand: "COSRX", name: "Advanced Snail 96 Mucin Power Essence", inci: "Snail Secretion Filtrate, Betaine, Butylene Glycol, 1,2-Hexanediol, Sodium Hyaluronate, Panthenol, Arginine, Allantoin, Ethyl Hexanediol, Sodium Polyacrylate, Carbomer, Phenoxyethanol" },
  { brand: "COSRX", name: "Low pH Good Morning Gel Cleanser", inci: "Water, Cocamidopropyl Betaine, Sodium Lauroyl Sarcosinate, Acrylates Copolymer, Styrax Japonicus Branch/Fruit/Leaf Extract, Ulmus Davidiana Root Extract, BHA, Butylene Glycol, Saccharomyces Ferment, Cryptomeria Japonica Leaf Extract, Nelumbo Nucifera Leaf Extract, Pinus Palustris Leaf Extract, Ulmus Davidiana Root Extract, Betaine, Melaleuca Alternifolia (Tea Tree) Leaf Oil, Sodium Chloride, Ethylhexylglycerin, 1,2-Hexanediol, Tromethamine, Allantoin, Tocopherol" },
  { brand: "COSRX", name: "BHA Blackhead Power Liquid", inci: "Salix Alba (Willow) Bark Water, Butylene Glycol, Betaine Salicylate, Niacinamide, 1,2-Hexanediol, Arginine, Panthenol, Sodium Hyaluronate, Xanthan Gum, Ethyl Hexanediol" },
  { brand: "COSRX", name: "AHA/BHA Clarifying Treatment Toner", inci: "Mineral Water, Salix Alba (Willow) Bark Water, Pyrus Malus (Apple) Fruit Water, Glycolic Acid, Betaine Salicylate, Butylene Glycol, 1,2-Hexanediol, Sodium Lactate, Arginine, Panthenol, Ethyl Hexanediol, Sodium Hyaluronate, Allantoin" },

  // ── Some By Mi ──
  { brand: "Some By Mi", name: "AHA BHA PHA 30 Days Miracle Toner", inci: "Water, Butylene Glycol, Dipropylene Glycol, Glycerin, Niacinamide, Melaleuca Alternifolia (Tea Tree) Leaf Water, Glycolic Acid, Salicylic Acid, Gluconolactone, Camellia Sinensis Leaf Extract, Centella Asiatica Extract, Allantoin, Panthenol, Sodium Hyaluronate, Hamamelis Virginiana (Witch Hazel) Extract, Citric Acid, 1,2-Hexanediol, Betaine, Trehalose, Polyglyceryl-10 Myristate, Polyglyceryl-10 Laurate, Ethylhexylglycerin, Carbomer, Tromethamine, Adenosine, Disodium EDTA" },

  // ── Klairs ──
  { brand: "Klairs", name: "Supple Preparation Unscented Toner", inci: "Water, Butylene Glycol, Dimethyl Sulfone, Betaine, Caprylic/Capric Triglyceride, Natto Gum, Sodium Hyaluronate, Disodium EDTA, Centella Asiatica Extract, Glycyrrhiza Glabra (Licorice) Root Extract, Polyquaternium-51, Chlorphenesin, Tocopheryl Acetate, Carbomer, Panthenol, Arginine, Luffa Cylindrica Fruit/Leaf/Stem Extract, Lysine HCL, Proline, Sodium PCA, Hydroxyethylcellulose" },
  { brand: "Klairs", name: "Freshly Juiced Vitamin Drop (Vitamin C)", inci: "Water, Propylen Glycol, Ascorbic Acid, Hydroxyethylcellulose, Centella Asiatica Extract, Citrus Junos Fruit Extract, Illicium Verum (Anise) Fruit Extract, Citrus Paradisi (Grapefruit) Fruit Extract, Nelumbium Speciosum Flower Extract, Paeonia Suffruticosa Root Extract, Scutellaria Baicalensis Root Extract, Polysorbate 60, Brassica Oleracea Italica (Broccoli) Extract, Chaenomeles Sinensis Fruit Extract, Orange Oil, Sodium Acrylate/Sodium Acryloyldimethyl Taurate Copolymer, Disodium EDTA, Isohexadecane, Caprylyl Glycol, Ethylhexylglycerin, 1,2-Hexanediol" },

  // ── Skin1004 ──
  { brand: "Skin1004", name: "Madagascar Centella Ampoule", inci: "Centella Asiatica Extract, Butylene Glycol, Glycerin, Betaine, 1,2-Hexanediol, Carbomer, Panthenol, Arginine, Disodium EDTA" },

  // ── Anessa ──
  { brand: "Anessa", name: "Perfect UV Sunscreen Milk SPF50+", inci: "Water, Ethylhexyl Methoxycinnamate, Isododecane, Zinc Oxide, Alcohol Denat., Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Titanium Dioxide, Isopropyl Myristate, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Glycerin, Dimethicone, Dextrin Palmitate, Trimethylsiloxysilicate, PEG-12 Dimethicone, PEG-3 Dimethicone, Talc, Diphenylsiloxy Phenyl Trimethicone, BHT, Mica, Xylitol, Sodium Hyaluronate, Tocopherol" },

  // ── Paula's Choice ──
  { brand: "Paula's Choice", name: "2% BHA Liquid Exfoliant", inci: "Aqua, Methylpropanediol, Butylene Glycol, Salicylic Acid, Polysorbate 20, Camellia Oleifera Leaf Extract, Sodium Hydroxide, Tetrasodium EDTA" },
  { brand: "Paula's Choice", name: "10% Niacinamide Booster", inci: "Aqua, Niacinamide, Acetyl Glucosamine, Ascorbyl Glucoside, Butylene Glycol, Phospholipids, Glycerin, Dimethicone, Sodium Hyaluronate, Allantoin, Boerhavia Diffusa Root Extract, Glycyrrhiza Glabra (Licorice) Root Extract, Epigallocatechin Gallate, Beta-Glucan, Panthenol, Carnosine, Oligopeptide-68, Hydroxyethylcellulose, Xanthan Gum, Sodium Hydroxide, Phenoxyethanol, Ethylhexylglycerin" },

  // ── ยี่ห้อไทย ──
  { brand: "Smooth E", name: "Gold Advanced Skin Recovery Serum", inci: "Aqua, Glycerin, Butylene Glycol, Niacinamide, Propanediol, Sodium Hyaluronate, Centella Asiatica Extract, Allantoin, Panthenol, Tocopheryl Acetate, Adenosine, Carbomer, Tromethamine, Phenoxyethanol, Ethylhexylglycerin" },
  { brand: "Srichand", name: "Srichand Enchanted Water Drop Moisturizer", inci: "Aqua, Glycerin, Dimethicone, Niacinamide, Butylene Glycol, Panthenol, Sodium Hyaluronate, Centella Asiatica Extract, Tocopheryl Acetate, Allantoin, Ceramide NP, Ethylhexylglycerin, Phenoxyethanol, Carbomer, Tromethamine" },
];

/** ค้นด้วยชื่อแบรนด์/ชื่อสินค้า (fuzzy คร่าวๆ) */
export function searchProducts(query: string): ProductEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/);
  return PRODUCT_DB.filter((p) => {
    const haystack = `${p.brand} ${p.name}`.toLowerCase();
    return terms.every((t) => haystack.includes(t));
  }).slice(0, 10);
}
