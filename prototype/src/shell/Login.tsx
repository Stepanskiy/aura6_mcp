import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { useStore } from "../store";
import { Button, Field, Input } from "../ui";
import { A6Mark } from "./Layout";

/** Простий вхід без ролей: лише ім’я для історії змін. */
export function Login() {
  const login = useStore((s) => s.login);
  const [name, setName] = useState("Олена Коваль");
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#160b2e] p-6">
      <div className="blob absolute -left-24 -top-24 h-96 w-96 rounded-full bg-violet-600/60" />
      <div className="blob absolute -right-20 top-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/50 [animation-delay:-4s]" />
      <div className="blob absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-orange-400/40 [animation-delay:-8s]" />
      <div className="relative grid w-full max-w-4xl items-center gap-10 md:grid-cols-2">
        <div className="text-white">
          <A6Mark gradient className="mb-6 w-56 drop-shadow-[0_10px_30px_rgba(217,70,239,0.45)]" title="Аура 6" />
          <div className="mb-5 font-display text-xl font-semibold">
            Аура 6 <span className="ml-1 text-sm font-medium text-violet-200/70">управлінський облік проєктів</span>
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Медіаплани, рахунки й маржа <span className="bg-gradient-to-r from-lime-300 via-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">без рутини</span>
          </h1>
          <p className="mt-4 max-w-md text-violet-100/80">Завантажте Excel будь-якого формату — модель розбере структуру, а цифри порахує система. Звіти за кілька кліків, рахунки за шаблоном агенції.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
            {["Імпорт з Excel + AI", "Версії плану", "Мультибренд рахунки", "Конструктор звітів"].map((t) => (
              <span key={t} className="rounded-full bg-white/10 px-3 py-1 text-violet-50 ring-1 ring-white/20">
                {t}
              </span>
            ))}
          </div>
        </div>
        <form
          className="rounded-3xl border border-white/20 bg-white/95 p-7 shadow-2xl shadow-fuchsia-900/40"
          onSubmit={(e) => {
            e.preventDefault();
            login(name);
          }}
        >
          <div className="mb-5 flex items-center gap-2 text-sm font-bold text-violet-700">
            <Sparkles size={16} /> Демо-доступ
          </div>
          <Field label="Ваше ім’я" hint="Без пароля і ролей. Ім’я потрапляє в історію змін.">
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </Field>
          <Button variant="primary" className="mt-6 w-full justify-center py-2.5 text-base" type="submit">
            Увійти <ArrowRight size={18} />
          </Button>
        </form>
      </div>
    </div>
  );
}
