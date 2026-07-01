export function Header() {
  return (
    <header className="flex items-center gap-3 py-4 px-5 border-b border-gray-200 bg-white shrink-0">
      <span className="text-3xl">🏥</span>
      <div>
        <h1 className="text-lg font-bold text-gray-900">Medical Triage Agent</h1>
        <p className="text-sm text-gray-500 mt-0.5">Describe your symptoms to get started</p>
      </div>
    </header>
  );
}
