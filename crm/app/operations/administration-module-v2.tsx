"use client";

import { useState } from "react";

import { AdministrationModule as LegacyAdministrationModule } from "./administration-module";
import { GovernanceCenter } from "./governance-center";
import { PrivacyExecutionPanel } from "./privacy-execution-panel";

type Props = React.ComponentProps<typeof LegacyAdministrationModule>;

export function AdministrationModuleV2(props: Props) {
  const [mode, setMode] = useState<"governance" | "operations">("governance");
  const canManage = props.access.isOwner || props.access.role === "admin" || props.access.permissions?.["admin.manage"] === true;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <nav className="document-tabs" aria-label="Áreas da administração">
        <button type="button" className={mode === "governance" ? "active" : ""} onClick={() => setMode("governance")}>Governança V2</button>
        <button type="button" className={mode === "operations" ? "active" : ""} onClick={() => setMode("operations")}>Dados, equipe e lixeira</button>
      </nav>
      {mode === "governance" ? (
        <>
          <GovernanceCenter canManage={canManage} />
          <PrivacyExecutionPanel canManage={canManage} />
        </>
      ) : <LegacyAdministrationModule {...props} />}
    </div>
  );
}
