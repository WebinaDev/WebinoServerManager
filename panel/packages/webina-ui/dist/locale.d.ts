/** Shared UI locale helpers (`fa` | `en`). */
export type UiLocale = "en" | "fa";
export declare function normalizeUiLocale(locale?: string | null): UiLocale;
export declare function isRtlLocale(locale?: string | null): boolean;
export declare function getIntlLocale(locale?: string | null): string;
/** Convert Latin digits to locale digits (`fa` → Persian ۰۱۲…). */
export declare function toLocaleDigits(value: string | number, locale?: string | null): string;
/** Normalize Persian/Arabic-Indic digits to Latin before API submit. */
export declare function toLatinDigits(value: string): string;
export declare function formatNumber(value: number, locale?: string | null, options?: Intl.NumberFormatOptions): string;
export declare function formatCurrency(value: number, locale?: string | null, currency?: string, options?: Intl.NumberFormatOptions): string;
export type FormatDateOptions = Intl.DateTimeFormatOptions & {
    includeTime?: boolean;
};
/** Intl-based date formatting. `fa` uses `fa-IR` (Persian calendar when supported). */
export declare function formatDate(value: string | number | Date, locale?: string | null, options?: FormatDateOptions): string;
//# sourceMappingURL=locale.d.ts.map