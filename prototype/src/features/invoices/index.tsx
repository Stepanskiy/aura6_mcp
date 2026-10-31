import { Route, Routes } from "react-router-dom";
import { InvoiceList } from "./InvoiceList";
import { InvoiceNew } from "./InvoiceNew";
import { InvoiceView } from "./InvoiceView";
import { InvoicePrint } from "./InvoicePrint";
import { Reconciliation } from "./Reconciliation";

export function InvoicesApp() {
  return (
    <Routes>
      <Route index element={<InvoiceList />} />
      <Route path="new" element={<InvoiceNew />} />
      <Route path="reconciliation" element={<Reconciliation />} />
      <Route path=":id" element={<InvoiceView />} />
      <Route path=":id/print" element={<InvoicePrint />} />
    </Routes>
  );
}
