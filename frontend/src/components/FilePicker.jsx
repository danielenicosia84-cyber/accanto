import { Camera, FileUp, FileText, X, Sparkles, Images } from "lucide-react";
import { useLang } from "@/context/LanguageContext";

export const UploadProgress = () => {
  const { t } = useLang();
  return (
    <div className="flex min-h-[60vh] animate-fade-up flex-col items-center justify-center text-center">
      <div className="relative mb-6">
        <div className="h-20 w-20 animate-spin rounded-full border-4 border-[#E8F5E9] border-t-[#2D6A4F]" />
        <Sparkles className="absolute inset-0 m-auto h-8 w-8 animate-pulse-soft text-[#2D6A4F]" />
      </div>
      <h2 className="font-heading text-xl font-bold text-slate-900">{t("analyzing")}</h2>
      <p className="mt-2 max-w-xs text-base text-slate-500">{t("analyzing_sub")}</p>
    </div>
  );
};

const Dropzone = ({ onCamera, onFiles, t }) => (
  <div data-testid="document-upload-dropzone" className="rounded-3xl border-2 border-dashed border-[#2D6A4F] bg-[#E8F5E9]/40 p-5 text-center">
    <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#2D6A4F] text-white"><Camera className="h-7 w-7" /></span>
    <p className="font-heading text-lg font-bold text-slate-900">{t("choose_file")}</p>
    <p className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-500"><FileUp className="h-4 w-4" /> JPG · PNG · PDF</p>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <button data-testid="pick-camera-button" onClick={onCamera} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] px-3 font-semibold text-white transition-colors hover:bg-[#1B4332]">
        <Camera className="h-5 w-5" /> {t("take_photo")}
      </button>
      <button data-testid="pick-file-button" onClick={onFiles} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-[#2D6A4F] bg-white px-3 font-semibold text-[#2D6A4F] transition-colors hover:bg-[#E8F5E9]">
        <Images className="h-5 w-5" /> {t("from_gallery")}
      </button>
    </div>
  </div>
);

const Preview = ({ file, preview, onClear, onChange, t }) => (
  <div className="rounded-3xl border border-slate-200 bg-white p-4">
    <div className="relative overflow-hidden rounded-2xl bg-slate-50">
      {preview ? (
        <img src={preview} alt="preview" className="max-h-72 w-full object-contain" />
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-slate-400">
          <FileText className="h-12 w-12" />
          <span className="px-4 text-center text-sm font-medium text-slate-600">{file.name}</span>
        </div>
      )}
      <button data-testid="clear-file-button" onClick={onClear} aria-label="Rimuovi" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white">
        <X className="h-5 w-5" />
      </button>
    </div>
    <button onClick={onChange} className="mt-2 min-h-[44px] w-full text-center text-sm font-semibold text-[#2D6A4F] hover:underline">{t("change_file")}</button>
  </div>
);

export const FilePicker = ({ file, preview, onCamera, onFiles, onClear }) => {
  const { t } = useLang();
  if (!file) return <Dropzone onCamera={onCamera} onFiles={onFiles} t={t} />;
  return <Preview file={file} preview={preview} onClear={onClear} onChange={onFiles} t={t} />;
};
