import { useLang } from "@/context/LanguageContext";
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";

export const ConfirmDeleteDialog = ({ title, description, onConfirm, confirmTestId, confirmLabel, children }) => {
  const { t } = useLang();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel className="mt-0 rounded-xl">{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction data-testid={confirmTestId} onClick={onConfirm} className="rounded-xl bg-red-600 hover:bg-red-700">
            {confirmLabel || t("confirm_delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
