import { LANGUAGES, LEVELS } from "@/lib/config";
import { Field } from "@/components/ui";

export type CourseFormValues = {
  title: string;
  description: string | null;
  language: string;
  level: string | null;
  price_cents: number;
  billing: "one_time" | "monthly";
};

/** Campos compartilhados entre criar e editar curso. */
export function CourseFields({ values }: { values?: CourseFormValues }) {
  const price = values ? (values.price_cents / 100).toFixed(2).replace(".", ",") : "";
  return (
    <div className="space-y-4">
      <Field label="Título" htmlFor="course-title">
        <input
          id="course-title"
          name="title"
          required
          maxLength={140}
          defaultValue={values?.title}
          className="input"
          placeholder="Ex.: Inglês para viagens"
        />
      </Field>
      <Field label="Descrição" htmlFor="course-description" hint="Conte o que o aluno vai aprender e com que frequência sai episódio novo.">
        <textarea
          id="course-description"
          name="description"
          rows={4}
          defaultValue={values?.description ?? ""}
          className="input"
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Idioma" htmlFor="course-language">
          <select id="course-language" name="language" defaultValue={values?.language ?? "en"} className="input">
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nível" htmlFor="course-level">
          <select id="course-level" name="level" defaultValue={values?.level ?? ""} className="input">
            <option value="">Todos os níveis</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preço (R$)" htmlFor="course-price" hint="Use 0 para curso gratuito.">
          <input id="course-price" name="price" inputMode="decimal" defaultValue={price} className="input" placeholder="49,90" />
        </Field>
        <Field label="Cobrança" htmlFor="course-billing">
          <select id="course-billing" name="billing" defaultValue={values?.billing ?? "monthly"} className="input">
            <option value="monthly">Assinatura mensal</option>
            <option value="one_time">Pagamento único</option>
          </select>
        </Field>
      </div>
    </div>
  );
}
