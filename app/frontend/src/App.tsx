import { PurchaseCard } from "./components/PurchaseCard";

function App() {
  return (
    <div className="page">
      <div className="page__hero">
        <span className="page__eyebrow">Flash Sale</span>
        <h1 className="page__title">Messi Argentina 2026 Special Edition Jersey</h1>
      </div>
      <div className="page__body">
        <PurchaseCard />
      </div>
    </div>
  );
}

export default App;
