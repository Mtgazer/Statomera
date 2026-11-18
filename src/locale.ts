import type { AnalysisErrorCode } from './analysis.ts'

export type Locale = 'en' | 'ar'

const enErrors = {
  fileType: 'Choose a file with a .csv extension.',
  empty: 'The file is empty.',
  fileSize: 'The file exceeds the 5 MiB limit.',
  encoding: 'Save the file as UTF-8 CSV and try again.',
  structure: 'The CSV contains an invalid field or unmatched quotes.',
  rowWidth: 'A record has a different number of fields than the header.',
  rowLimit: 'The file exceeds the 100,000-record limit.',
  columnLimit: 'The file exceeds the 32-column limit.',
  fieldLimit: 'A field exceeds the 4,096-character limit.',
  headers: 'Column names must be present and unique.',
  salaryColumn: 'Include one salary column named salary, راتب or الراتب.',
  read: 'The file could not be processed. Try selecting it again.',
  engine: 'The analysis engine could not finish. Try again in a supported browser.',
  timeout: 'Analysis reached the 10-second limit. Try a smaller file.',
  cancelled: 'Analysis cancelled.',
} satisfies Record<AnalysisErrorCode, string>

const arErrors: typeof enErrors = {
  fileType: 'اختر ملفًا بامتداد ‎.csv‎.',
  empty: 'الملف فارغ.',
  fileSize: 'يتجاوز الملف الحد الأقصى البالغ ٥ ميبيبايت.',
  encoding: 'احفظ الملف بصيغة CSV بترميز UTF-8 ثم أعد المحاولة.',
  structure: 'يحتوي الملف على حقل غير صالح أو علامات اقتباس غير مغلقة.',
  rowWidth: 'يختلف عدد الحقول في أحد السجلات عن عدد الأعمدة.',
  rowLimit: 'يتجاوز الملف الحد الأقصى البالغ ١٠٠٬٠٠٠ سجل.',
  columnLimit: 'يتجاوز الملف الحد الأقصى البالغ ٣٢ عمودًا.',
  fieldLimit: 'يتجاوز أحد الحقول الحد الأقصى البالغ ٤٬٠٩٦ حرفًا.',
  headers: 'يجب أن تكون أسماء الأعمدة موجودة وفريدة.',
  salaryColumn: 'أضف عمود راتب واحدًا باسم salary أو راتب أو الراتب.',
  read: 'تعذّرت معالجة الملف. حاول اختياره مجددًا.',
  engine: 'تعذّر إكمال التحليل. أعد المحاولة في متصفح مدعوم.',
  timeout: 'انتهت مهلة التحليل البالغة ١٠ ثوانٍ. جرّب ملفًا أصغر.',
  cancelled: 'أُلغي التحليل.',
}

export const messages = {
  en: {
    language: 'Language', theme: 'Theme', dark: 'Dark', light: 'Light',
    title: 'CSV analysis', upload: 'Open a dataset', choose: 'Choose CSV',
    guidance: 'UTF-8 CSV up to 5 MiB. Include a header and a salary column.',
    privacy: 'File contents stay in this tab.', bytes: 'bytes',
    busy: 'Analyzing file…', cancel: 'Cancel',
    summary: 'Analysis summary', mean: 'Mean salary', unavailable: 'Unavailable',
    rows: 'Records', columns: 'Columns', valid: 'Valid salaries',
    blank: 'Blank salaries', invalid: 'Invalid salaries',
    method: 'Mean of valid, finite decimal observations. Blank and invalid cells are excluded. Uses 64-bit floating point. Displayed values may be rounded.',
    preview: 'Dataset preview', firstRows: 'First records from the file.',
    noRows: 'The file contains column headers only.',
    quality: 'Missing and invalid values', column: 'Column', missing: 'Blank cells',
    rejected: 'Examples of invalid salaries', record: 'Record', value: 'Value',
    errors: enErrors,
  },
  ar: {
    language: 'اللغة', theme: 'المظهر', dark: 'داكن', light: 'فاتح',
    title: 'تحليل ملفات CSV', upload: 'افتح مجموعة بيانات', choose: 'اختر ملف CSV',
    guidance: 'ملف CSV بترميز UTF-8 حتى ٥ ميبيبايت، مع صف عناوين وعمود للراتب.',
    privacy: 'يبقى محتوى الملف في علامة التبويب هذه.', bytes: 'بايت',
    busy: 'جارٍ تحليل الملف…', cancel: 'إلغاء',
    summary: 'ملخص التحليل', mean: 'متوسط الراتب', unavailable: 'غير متاح',
    rows: 'السجلات', columns: 'الأعمدة', valid: 'الرواتب الصالحة',
    blank: 'الرواتب الفارغة', invalid: 'الرواتب غير الصالحة',
    method: 'متوسط القيم العشرية الصالحة والمحدودة. تُستبعد الخلايا الفارغة وغير الصالحة. يستخدم الحساب أعدادًا بفاصلة عائمة بدقة ٦٤ بت. قد تُقرَّب القيم المعروضة.',
    preview: 'معاينة البيانات', firstRows: 'السجلات الأولى من الملف.',
    noRows: 'يحتوي الملف على عناوين الأعمدة فقط.',
    quality: 'القيم المفقودة وغير الصالحة', column: 'العمود', missing: 'الخلايا الفارغة',
    rejected: 'أمثلة على الرواتب غير الصالحة', record: 'السجل', value: 'القيمة',
    errors: arErrors,
  },
} as const

export function formatNumber(value: number, locale: Locale): string {
  const options: Intl.NumberFormatOptions = { maximumSignificantDigits: 12 }
  if (Math.abs(value) >= 1e12 || (value !== 0 && Math.abs(value) < 1e-6)) {
    options.notation = 'scientific'
  }
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en', options).format(value)
}
