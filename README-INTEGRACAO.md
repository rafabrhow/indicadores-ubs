# Importação PEC — Indicadores-UBS

Arquivos desta etapa:

- `src/lib/pec/parser.ts`
  - lê os CSVs do e-SUS PEC;
  - localiza automaticamente a tabela após os filtros;
  - suporta os arquivos `;` e a codificação encontrada nos CSVs enviados;
  - identifica paciente por CPF, CNS ou hash de nome + nascimento;
  - separa dados básicos de dados específicos do relatório.

- `src/app/api/pec/importar/route.ts`
  - autentica a enfermeira pelo Firebase Admin;
  - cria o histórico em `ubs/{ubsId}/importacoesPEC`;
  - grava pacientes em `ubs/{ubsId}/pacientes`;
  - preserva cada registro dentro de `importacoesPEC/{id}/registros`;
  - não apaga importações anteriores.

- `src/components/pec/ImportarPECModal.tsx`
  - assistente de 4 etapas inspirado no fluxo visual enviado;
  - Upload → Validação → Processamento → Concluído.

## Integração na página Config

Importe:

```tsx
import ImportarPECModal from "@/components/pec/ImportarPECModal";
```

Adicione estados:

```tsx
const [modalImportarPEC, setModalImportarPEC] = useState(false);
```

No botão/card "Importar pacientes do e-SUS PEC":

```tsx
onClick={() => setModalImportarPEC(true)}
```

E perto do final do JSX:

```tsx
<ImportarPECModal
  aberto={modalImportarPEC}
  onFechar={() => setModalImportarPEC(false)}
  onConcluido={(resultado) => {
    console.log("Importação PEC concluída:", resultado);
  }}
/>
```

## Regras Firestore necessárias

Como o histórico possui uma subcoleção `registros`, as regras precisam contemplar:

```js
match /ubs/{ubsId}/importacoesPEC/{importacaoId} {
  allow read, write: if pertenceAUBS(ubsId);

  match /registros/{registroId} {
    allow read, write: if pertenceAUBS(ubsId);
  }
}
```

A coleção `pacientes` já existe nas regras atuais.

## Observação importante sobre indicadores

A propriedade `indicadoresOrigemPEC` serve somente para registrar de qual relatório temático veio o dado (por exemplo, relatório Diabetes → C4).

Ela NÃO deve ser tratada como elegibilidade oficial do indicador.

O motor oficial C1–C7 será implementado em uma etapa própria, usando as regras técnicas do Ministério da Saúde/Saúde Brasil 360.
