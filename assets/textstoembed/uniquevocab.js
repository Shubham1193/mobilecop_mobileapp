// ----------------------------
// 1. Soundex Algorithm Implementation
// ----------------------------
function getSoundex(word) {
  if (!word || typeof word !== 'string') return '';
  
  const a = word.toLowerCase().split('');
  const firstLetter = a.shift().toUpperCase();
  
  const codes = {
    a: '', e: '', i: '', o: '', u: '', y: '', h: '', w: '',
    b: 1, f: 1, p: 1, v: 1,
    c: 2, g: 2, j: 2, k: 2, q: 2, s: 2, x: 2, z: 2,
    d: 3, t: 3,
    l: 4,
    m: 5, n: 5,
    r: 6
  };

  const res = [firstLetter];
  let prevCode = codes[firstLetter.toLowerCase()] || null; // Start coding from 1st char logic or null

  for (let i = 0; i < a.length; i++) {
    const char = a[i];
    const currentCode = codes[char];

    // 1. Skip vowels/h/w (represented as '')
    // 2. Skip if same code as previous (Soundex rule: merge adjacents)
    if (currentCode !== undefined && currentCode !== '' && currentCode !== prevCode) {
      res.push(currentCode);
    }
    
    // Update previous code (even if it was a vowel, to handle spacing correctly, 
    // though standard Soundex ignores vowels for separation usually, this is a simplified version)
    if (currentCode !== '') {
        prevCode = currentCode;
    }
  }

  // Pad with zeros or truncate to length 4
  return (res.join('') + '0000').slice(0, 4);
}

// ----------------------------
// 2. Data & Synonyms
// ----------------------------
const synonymMap = {
  "store": "shop",
  "stores": "shop",
  "mart": "shop",
  "locate": "search",
  "find": "search",
  "qty": "quantity",
  "amt": "price",
  "cost": "price",
  "rate": "price",
  "coke": "Coca Cola" ,
  "stored" : 'store'
};

const commonStopWords = new Set([
  "for", "to", "in", "at", "on", "with", "and", "the", "a", "an", "of", "is", "are"
]);

const productWords = [
    "Coca", "Cola", "500ml", "Pepsi", "Sprite", "600ml", "Thumbs", "Up", 
    "Fanta", "Orange", "Maaza", "Mango", "Drink", "7UP", "Mountain", "Dew", 
    "Mirinda", "Limca", "Appy", "Fizz", "Sting", "Energy", "Red", "Bull", 
    "Bisleri", "Water", "1L", "Kinley", "Aquafina", "Real", "Tropicana"
];

const shopWords = [
    "Reliance", "Smart", "DMart", "Big", "Bazaar", "Spencer’s", "JioMart"
];

const commandWords = [
    "search", "shop", "name", "full", "partial", "user", "quickly",
    "collect", "details", "location", "owner", "information",
    "product", "brand", "category", "manufacturer", "items",
    "add", "edit", "update", "price", "quantity", "save", "clear", "remove"
];

// ----------------------------
// 3. Build Soundex Maps (Pre-computation)
// ----------------------------
// We create a map where Key = SoundexCode, Value = CorrectWord
// Example: { "P120": "Pepsi", "S630": "Sprite" }

const createSoundexMap = (wordList) => {
  const map = {};
  wordList.forEach(word => {
    const code = getSoundex(word);
    // If collision occurs (two words same sound), we keep the first one 
    // or you could implement an array to check edit distance. 
    // For this specific vocab, simple overwriting is usually fine.
    if (!map[code]) {
        map[code] = word;
    }
  });
  return map;
};

const maps = {
  global: createSoundexMap([...commandWords, ...shopWords, ...productWords]),
  shop: createSoundexMap(shopWords),
  product: createSoundexMap(productWords)
};

// ----------------------------
// 4. Correction Function
// ----------------------------
export function correctASR(asrOutput, context) {
    if (!asrOutput) return "";

    // 1. Determine which map to use
    let activeMap;
    let activeList; // For exact casing check
    
    if (context === 'shop') {
        activeMap = maps.shop;
        activeList = shopWords;
    } else if (context === 'product') {
        activeMap = maps.product;
        activeList = productWords;
    } else {
        activeMap = maps.global;
        activeList = [...commandWords, ...shopWords, ...productWords];
    }

    const words = asrOutput.split(/\s+/);

    const corrected = words.map(word => {
        let cleanWord = word.trim();
        let lowerWord = cleanWord.toLowerCase();

        // A. STOP WORDS: Return as is (prevents "for" -> "four" or random match)
        if (commonStopWords.has(lowerWord)) {
            return lowerWord; 
        }

        // B. SYNONYMS: Fix logic errors (Store -> Shop)
        if (synonymMap[lowerWord]) {
            cleanWord = synonymMap[lowerWord];
            lowerWord = cleanWord.toLowerCase();
        }

        // C. EXACT MATCH: If it exists in vocab, return the proper casing
        const exactMatch = activeList.find(w => w.toLowerCase() === lowerWord);
        if (exactMatch) return exactMatch;

        // D. SOUNDEX LOOKUP: Fix phonetic errors
        const code = getSoundex(cleanWord);
        const phoneticMatch = activeMap[code];

        if (phoneticMatch) {
            // Optional: You can calculate Levenshtein distance here between 
            // cleanWord and phoneticMatch to ensure they aren't wildly different 
            // despite having the same soundex code.
            return phoneticMatch;
        }

        // E. Fallback
        return cleanWord;
    });

    return corrected.join(' ');
}

// ----------------------------
// EXAMPLES
// ----------------------------

// 1. Synonym + Stop word check
// "search" (S620), "for" (skip), "store" (-> shop -> S100), "name" (N500)
console.log(correctASR("search for store name")); 
// Output: "search for shop name"

// 2. Phonetic Check
// "Pepsy" -> P120 -> Matches "Pepsi"
console.log(correctASR("I want Pepsy", "product")); 
// Output: "I want Pepsi"

// 3. Context Check
// "Smart" in product context might fail or remain Smart, but in shop context:
console.log(correctASR("Reliance Smrt", "shop")); 
// Output: "Reliance Smart"