const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/\u00a0/g, ' ').replace(/€/g, '').replace(/%/g, '').replace(/\s/g, '').replace(',', '.');
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const findWorkbookSheetName = (sheetNames, expectedName) => {
  const expectedNormalized = normalize(expectedName);
  return (
    sheetNames.find((name) => normalize(name) === expectedNormalized) ??
    sheetNames.find((name) => {
      const candidate = normalize(name);
      return candidate.includes(expectedNormalized) || expectedNormalized.includes(candidate);
    }) ??
    null
  );
};

export const parseMarginCatalogFromWorkbook = (workbook, XLSX) => {
  const actualSheetName = findWorkbookSheetName(workbook.SheetNames, 'Produits');
  if (!actualSheetName) {
    throw new Error('Onglet Produits introuvable');
  }

  const sheet = workbook.Sheets[actualSheetName];
  if (!sheet) {
    throw new Error('Onglet Produits vide');
  }

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });

  const cellText = (value) => String(value ?? '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  const headerScore = (cells) => {
    const normalized = cells.map(normalize);
    const hasProduct = normalized.some((cell) => cell === 'produit' || cell.includes('libelle') || cell.includes('designation'));
    const hasFamily = normalized.some((cell) => cell.includes('famille'));
    const hasCost = normalized.some((cell) => cell === 'cr' || cell.includes('cout') || cell.includes('revient') || cell.includes('cm ht'));
    const hasPrice = normalized.some((cell) => cell.includes('pv') || cell.includes('prix'));
    const hasMargin = normalized.some((cell) => cell.includes('marge'));
    return Number(hasProduct) * 4 + Number(hasFamily) * 2 + Number(hasCost) + Number(hasPrice) + Number(hasMargin);
  };

  let headerIndex = rows.findIndex((row, index) => index < 60 && headerScore(row.map(cellText)) >= 5);
  if (headerIndex === -1) {
    headerIndex = rows.findIndex((row, index) => index < 60 && row.map(cellText).some((cell) => normalize(cell) === 'produit'));
  }
  if (headerIndex === -1) {
    throw new Error('Ligne d en-tete Produits introuvable');
  }

  const rawHeaders = rows[headerIndex].map(cellText);
  const headers = rawHeaders.map(normalize);
  const findColumn = (...matchers) => {
    for (const matcher of matchers) {
      const index = headers.findIndex((header, columnIndex) => matcher(header, rawHeaders[columnIndex] ?? ''));
      if (index !== -1) return index;
    }
    return -1;
  };

  const productCol = findColumn(
    (header) => header === 'produit',
    (header) => header.includes('libelle') || header.includes('designation'),
    (header) => header.includes('produit')
  );
  const familyCol = findColumn((header) => header.includes('famille'));
  const costCol = findColumn(
    (header) => header === 'cr',
    (header) => header.includes('cout') && header.includes('revient'),
    (header) => header.includes('cr ht'),
    (header) => header.includes('cm ht')
  );
  const priceCol = findColumn(
    (header) => header.includes('pv ht'),
    (header) => header.includes('prix') && header.includes('ht'),
    (header) => header.includes('prix') && header.includes('ttc'),
    (header) => header.includes('pv'),
    (header) => header.includes('prix')
  );
  const marginEuroCol = findColumn(
    (header, rawHeader) => header.includes('marge') && !rawHeader.includes('%') && (header.includes('eur') || header.includes('euro') || header.includes('montant')),
    (header, rawHeader) => header.includes('marge') && !rawHeader.includes('%') && header.includes('ht'),
    (header, rawHeader) => header === 'marge' && !rawHeader.includes('%')
  );
  const marginPercentCol = findColumn(
    (header, rawHeader) => header.includes('marge') && rawHeader.includes('%'),
    (header) => header.includes('marge') && (header.includes('percent') || header.includes('pourcentage'))
  );

  if (productCol === -1) {
    throw new Error('Colonne Produit introuvable');
  }

  return rows
    .slice(headerIndex + 1)
    .map((row, index) => {
      const label = cellText(row[productCol]);
      if (!label) return null;

      const family = familyCol === -1 ? '' : cellText(row[familyCol]);
      const costHt = costCol === -1 ? null : toNumber(row[costCol]);
      const sellPriceHt = priceCol === -1 ? null : toNumber(row[priceCol]);
      const marginEuro = marginEuroCol === -1 ? null : toNumber(row[marginEuroCol]);
      const marginPercent = marginPercentCol === -1 ? null : toNumber(row[marginPercentCol]);
      const rowNumber = headerIndex + index + 2;

      return {
        label,
        normalized: `${rowNumber}-${normalize(label)}`,
        costHt,
        sellPriceHt,
        marginPercent,
        marginEuro,
        sourceSheet: actualSheetName,
        section: family,
      };
    })
    .filter(Boolean);
};

export const buildMarginCatalogFromWorkbook = async (file) => {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellFormula: true, cellText: true, cellNF: false });
  return parseMarginCatalogFromWorkbook(workbook, XLSX);
};
