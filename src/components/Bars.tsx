// 横棒グラフ（1系列）。項目名・棒・割合と件数を1行ずつ並べる。
// 色は1色（--chart-bar）だけで、何の棒かは左の項目名で示す（凡例なし）。数値は文字色で出す。
// 表（table）として組むので、画面の読み上げでもそのまま読める
export interface BarRow {
  key: string;
  label: string;
  count: number;
}

export function Bars({ title, rows, total, note, unit }: { title: string; rows: BarRow[]; total: number; note?: string; unit: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <figure className="bars">
      <figcaption>
        <strong>{title}</strong>
        {note && <span className="small muted"> {note}</span>}
      </figcaption>
      <table>
        <tbody>
          {rows.map((r) => {
            const pct = total ? Math.round((r.count / total) * 100) : 0;
            return (
              <tr key={r.key} title={`${r.label}: ${unit(r.count)} (${pct}%)`}>
                <th scope="row">{r.label}</th>
                <td className="bars-track" aria-hidden>
                  {r.count > 0 && <span className="bars-fill" style={{ width: `${(r.count / max) * 100}%` }} />}
                </td>
                <td className="bars-value">
                  {pct}% <span className="muted">({r.count})</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}
