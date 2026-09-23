export interface ChapterVerse {
  number: number;
  text: string;
}

export interface ChapterResult {
  bookId: string;
  bookName: string;
  chapter: number;
  translationId: string;
  translationName: string;
  verses: ChapterVerse[];
  copyright?: string;
  source?: "youversion" | "helloao";
}

export interface TranslationInfo {
  id: string;
  name: string;
  englishName: string;
  language: string;
  languageEnglishName?: string;
  shortName: string;
  textDirection: "ltr" | "rtl";
  numberOfBooks: number;
  totalNumberOfChapters: number;
  copyright?: string;
}

export interface BibleServiceProvider {
  getTranslations(): Promise<TranslationInfo[]>;
  getChapter(
    translationId: string,
    bookId: string,
    chapter: number
  ): Promise<ChapterResult>;
}

export class BibleReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BibleReferenceError";
  }
}

export class UnmappedTranslationError extends Error {
  constructor(translationId: string) {
    super(`Translation not available from primary provider: ${translationId}`);
    this.name = "UnmappedTranslationError";
  }
}
