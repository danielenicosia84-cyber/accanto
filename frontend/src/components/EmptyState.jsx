export const EmptyState = ({ icon: Icon, text, testId }) => (
  <div data-testid={testId} className="animate-fade-up rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
    <Icon className="mx-auto mb-3 h-10 w-10 text-slate-300" />
    <p className="text-base text-slate-500">{text}</p>
  </div>
);
