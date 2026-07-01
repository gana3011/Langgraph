import { Interrupt } from "../types";

interface ApprovalPanelProps {
  interrupt: Extract<Interrupt, { type: "approval" }>;
  editUrgency: string;
  setEditUrgency: (value: string) => void;
  editResponse: string;
  setEditResponse: (value: string) => void;
  submitApproval: (approve: boolean) => void;
}

export function ApprovalPanel({
  interrupt,
  editUrgency,
  setEditUrgency,
  editResponse,
  setEditResponse,
  submitApproval,
}: ApprovalPanelProps) {
  return (
    <div className="flex gap-2.5 max-w-[85%] self-start">
      <div className="text-2xl shrink-0 w-9 h-9 flex items-center justify-center">
        🩺
      </div>
      <div className="bg-green-50 border border-green-300 rounded-2xl rounded-bl-sm p-4 flex flex-col gap-3.5 max-w-xl animate-fadeUp">
        <h3 className="text-[0.95rem] font-bold text-green-900">
          Human Review Required
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <strong className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
              Symptoms
            </strong>
            <ul className="pl-4 text-sm text-gray-700 list-disc">
              {interrupt.symptoms.map((s, i) => (
                <li key={i} className="mb-0.5">
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <strong className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
              Red Flags
            </strong>
            <ul className="pl-4 text-sm text-gray-700 list-disc">
              {(interrupt.red_flags ?? []).length === 0 ? (
                <li className="text-gray-400">None detected</li>
              ) : (
                (interrupt.red_flags ?? []).map((f, i) => (
                  <li key={i} className="text-red-600 mb-0.5">
                    {f}
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-gray-700">
          Urgency
          <select
            value={editUrgency}
            onChange={(e) => setEditUrgency(e.target.value)}
            className="p-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-gray-700">
          Reasoning
          <span className="text-[0.85rem] font-normal text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-200 leading-relaxed">
            {interrupt.reasoning ?? "No reasoning provided."}
          </span>
        </label>

        <label className="flex flex-col gap-1.5 text-[0.85rem] font-semibold text-gray-700">
          Response to Patient
          <textarea
            value={editResponse}
            onChange={(e) => setEditResponse(e.target.value)}
            rows={4}
            className="p-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-y"
          />
        </label>

        <div className="flex gap-2.5 mt-2">
          <button
            className="flex-1 py-2 px-3 border-none rounded-md text-sm font-semibold cursor-pointer transition-opacity bg-green-600 text-white hover:opacity-85"
            onClick={() => submitApproval(true)}
          >
            ✅ Approve
          </button>
          <button
            className="flex-1 py-2 px-3 border-none rounded-md text-sm font-semibold cursor-pointer transition-opacity bg-blue-600 text-white hover:opacity-85"
            onClick={() => submitApproval(false)}
          >
            ✏️ Edit & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
