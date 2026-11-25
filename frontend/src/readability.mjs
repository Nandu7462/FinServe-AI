export const wordLimit = 25

const languages = {
  English: ['en', {
    'in the event that': 'if', 'in order to': 'to', 'prior to': 'before',
    'subsequent to': 'after', 'at this point in time': 'now', 'with regard to': 'about',
    'utilize': 'use', 'utilise': 'use', 'remit payment': 'send payment',
    'commence': 'start', 'terminate': 'end', 'per annum': 'per year',
    'outstanding balance': 'remaining balance', 'accrued interest': 'interest built up',
    'date of maturity': 'maturity date', 'on a monthly basis': 'monthly',
  }],
  Spanish: ['es', {'con anterioridad a': 'antes de', 'con posterioridad a': 'después de', 'con el fin de': 'para'}],
  French: ['fr', {'dans le but de': 'pour', 'au préalable': "à l’avance", 'ultérieurement': 'plus tard'}],
  German: ['de', {'zum gegenwärtigen Zeitpunkt': 'jetzt', 'infolgedessen': 'deshalb', 'diesbezüglich': 'dazu'}],
  Hindi: ['hi', {'तत्पश्चात': 'इसके बाद', 'के संबंध में': 'के बारे में', 'वर्तमान समय में': 'अभी'}],
}

const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const sentenceWarning = /^(Security Advisory|Aviso de Seguridad|Avis de Sécurité|Sicherheitshinweis|सुरक्षा परामर्श):/imu

export function protectedPhrases(item) {
  const {source = {}, facts = {}} = item
  const feeSentence = facts.product && facts.fee && facts.effective_date &&
    `The annual fee for your ${facts.product} will be ${facts.fee} from ${facts.effective_date}.`
  return [source.statement, source.evidence, feeSentence, source.bank, source.product,
    ...(item.body || '').split(/\n\s*\n/).filter(p => sentenceWarning.test(p))].filter(Boolean)
}

export function checkText(text, language, protectedText = []) {
  const [locale, glossary] = languages[language] || languages.English
  const terms = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])(?:${Object.keys(glossary).map(escape).join('|')})(?![\\p{L}\\p{M}\\p{N}_])`, 'giu')
  const sentenceSegments = new Intl.Segmenter(locale, {granularity:'sentence'})
  const words = new Intl.Segmenter(locale, {granularity:'word'})
  const ranges = []
  for (const phrase of protectedText.filter(Boolean)) {
    for (const match of text.matchAll(new RegExp(escape(phrase), 'g'))) {
      ranges.push([match.index, match.index + phrase.length])
    }
  }
  for (const match of text.matchAll(/https?:\/\/\S+|[\w.+-]+@[\w.-]+/gi)) {
    ranges.push([match.index, match.index + match[0].length])
  }
  const locked = (start, end) => ranges.some(([a,b]) => start < b && a < end)
  const findings = []
  let simplified = ''
  for (const {segment, index} of sentenceSegments.segment(text)) {
    const count = Array.from(words.segment(segment)).filter(w => w.isWordLike).length
    const isLong = count > wordLimit
    if (isLong) findings.push({kind:'Long sentence', text:segment.trim(), note:`${count} words`})
    let updated = segment.replace(terms, (term, offset) => {
      const fixed = locked(index + offset, index + offset + term.length)
      let plain = glossary[term.toLocaleLowerCase(locale)]
      if (/^\p{Lu}/u.test(term)) plain = plain.charAt(0).toLocaleUpperCase(locale) + plain.slice(1)
      findings.push({kind:'Jargon', text:term, note:fixed ? 'Protected wording' : `Use “${plain}”`})
      return fixed ? term : plain
    })
    // A semicolon joining two clauses is a safe place to introduce a sentence break.
    if (isLong && !locked(index, index + segment.length)) {
      updated = updated.replace(/;[ \t]+(\p{L})/gu, (_, first) => '. ' + first.toLocaleUpperCase(locale))
      if (locale === 'en' && !/\b(if|unless|provided|when|only|whenever)\b/i.test(segment)) {
        updated = updated.replace(/, and (we|you|they|it)\b/gi, (_, pronoun) => '. ' + pronoun[0].toUpperCase() + pronoun.slice(1))
      }
    }
    simplified += updated
  }
  return {findings, simplified}
}
