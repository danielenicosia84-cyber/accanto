import { useEffect, useMemo, useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/context/LanguageContext";
import api, { errorMessage } from "@/lib/api";

const STYLE = { layout: "vertical", shape: "pill", height: 52, label: "paypal" };
const CARD_STYLE = { ...STYLE, label: "pay" };

const Fallback = ({ onReload }) => (
  <div data-testid="paypal-slow" className="rounded-xl bg-[#FEF3C7] p-3 text-sm text-[#92400E]">
    I pulsanti PayPal stanno impiegando piu' del previsto.{" "}
    <button type="button" onClick={onReload} className="font-semibold underline">Ricarica</button>
  </div>
);

export const PayPalCheckout = ({ config, plan, interval, paypalPlanId, onActivated, onBusy }) => {
  const { t } = useLang();
  const isLifetime = plan === "lifetime";
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);

  const options = useMemo(() => ({
    clientId: config.paypal_client_id,
    currency: "EUR",
    locale: "it_IT",
    intent: isLifetime ? "capture" : "subscription",
    vault: !isLifetime,
    components: "buttons",
    "disable-funding": "paylater,venmo,sepa,mybank",
  }), [config.paypal_client_id, isLifetime]);

  useEffect(() => {
    if (ready) return undefined;
    const id = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(id);
  }, [ready]);

  const activateSubscription = async (data) => {
    onBusy?.(true);
    try {
      const res = await api.post("/billing/paypal/subscription/activate", { subscription_id: data.subscriptionID, plan, interval });
      onActivated(res.data);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { onBusy?.(false); }
  };

  const createOrder = async () => {
    const { data } = await api.post("/billing/paypal/order/create", { plan: "lifetime" });
    return data.order_id;
  };

  const captureOrder = async (data) => {
    onBusy?.(true);
    try {
      const res = await api.post("/billing/paypal/order/capture", { order_id: data.orderID });
      onActivated(res.data);
    } catch (err) { toast.error(errorMessage(err)); }
    finally { onBusy?.(false); }
  };

  const common = isLifetime
    ? { createOrder, onApprove: captureOrder }
    : { createSubscription: (_d, actions) => actions.subscription.create({ plan_id: paypalPlanId }), onApprove: activateSubscription };

  const onError = (err) => { console.warn("PayPal error", err); toast.error("PayPal: si e' verificato un problema. Riprova."); };
  const onInit = () => setReady(true);

  if (!isLifetime && !paypalPlanId) {
    return <p data-testid="paypal-not-ready" className="rounded-xl bg-[#FEF3C7] p-3 text-sm text-[#92400E]">{t("paypal_not_ready")}</p>;
  }

  return (
    <PayPalScriptProvider options={options}>
      <div className="space-y-3" data-testid="paypal-buttons">
        {slow && !ready && <Fallback onReload={() => window.location.reload()} />}
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">PayPal</p>
          <p className="mb-2 text-xs text-slate-500">{isLifetime ? t("pay_paypal_once_sub") : t("pay_paypal_sub")}</p>
          <PayPalButtons fundingSource="paypal" style={STYLE} {...common} onInit={onInit} onError={onError} onCancel={() => toast.message(t("payment_cancelled"))} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">{t("pay_card_title")}</p>
          <p className="mb-2 text-xs text-slate-500">{t("pay_card_sub")}</p>
          <PayPalButtons fundingSource="card" style={CARD_STYLE} {...common} onInit={onInit} onError={onError} />
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> {config.paypal_mode === "sandbox" ? "Modalita' test (sandbox): nessun addebito reale" : t("secure_payment_paypal")}</p>
      </div>
    </PayPalScriptProvider>
  );
};
