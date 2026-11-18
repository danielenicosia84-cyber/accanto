import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import { useProfiles } from "@/context/ProfileContext";
import { useBilling } from "@/context/BillingContext";
import api, { errorMessage, isPaywall } from "@/lib/api";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { LegalNotice } from "@/components/LegalNotice";
import { UploadLocked } from "@/components/UploadLocked";
import { FilePicker, UploadProgress } from "@/components/FilePicker";

export default function Upload() {
  const { t, lang } = useLang();
  const { activeProfile, activeId } = useProfiles();
  const { billing, refreshBilling } = useBilling();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const cameraRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setError("");
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  };

  const clear = () => {
    setFile(null); setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const upload = async () => {
    if (!file || !activeId) return;
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("profile_id", activeId);
    fd.append("lang", lang);
    try {
      const { data } = await api.post("/documents/upload", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      refreshBilling();
      toast.success(t("upload_title"));
      navigate(`/document/${data.id}`);
    } catch (err) {
      if (isPaywall(err)) { toast.error(errorMessage(err)); navigate("/pricing"); return; }
      setError(errorMessage(err));
      setUploading(false);
    }
  };

  if (uploading) return <UploadProgress />;

  const locked = billing && !billing.can_upload;

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-slate-900">{t("upload_title")}</h1>
        <p className="mt-1 text-base text-slate-600">{t("upload_sub")}</p>
        {activeProfile && <p className="mt-1 text-sm font-semibold text-[#2D6A4F]">{t("active_profile")}: {activeProfile.name}</p>}
      </div>

      {locked ? <UploadLocked /> : (
        <>
          <input ref={fileRef} data-testid="file-input" type="file" accept="image/*,application/pdf" onChange={pick} className="hidden" />
          <input ref={cameraRef} data-testid="camera-input" type="file" accept="image/*" capture="environment" onChange={pick} className="hidden" />
          <FilePicker file={file} preview={preview} onCamera={() => cameraRef.current?.click()} onFiles={() => fileRef.current?.click()} onClear={clear} />
          <LegalNotice variant="consent" />
          {error && <p data-testid="upload-error" className="rounded-xl bg-[#FFF5F5] px-4 py-3 text-sm font-medium text-[#C53030]">{error}</p>}
          <button
            data-testid="upload-submit-button" onClick={upload} disabled={!file}
            className="flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#2D6A4F] text-lg font-semibold text-white transition-colors hover:bg-[#1B4332] disabled:opacity-40"
          >
            <Sparkles className="h-5 w-5" /> {t("upload_btn")}
          </button>
        </>
      )}

      <DisclaimerBanner compact />
    </div>
  );
}
