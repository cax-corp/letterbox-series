import { languages, t, useLanguage, type AppLanguage } from "./i18n";
export default function LanguageSelect({
  value,
  onChange,
}: {
  value: AppLanguage;
  onChange: (code: AppLanguage) => void;
}) {
  useLanguage();
  return (
    <label className="field">
      {t("Langue")}
      <select
        aria-label={t("Langue")}
        value={value}
        onChange={(e) => onChange(e.target.value as AppLanguage)}
      >
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
          </option>
        ))}
      </select>
    </label>
  );
}
