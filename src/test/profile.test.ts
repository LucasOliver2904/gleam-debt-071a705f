import { describe, expect, it } from "vitest";
import { profileFromUser } from "@/lib/profile-name";

describe("Nome e avatar exibidos na conta", () => {
  it("usa o primeiro nome do cadastro", () => {
    expect(profileFromUser({ user_metadata: { full_name: "lucas eurípedes de oliveira" } }))
      .toEqual({ name: "Lucas", initial: "L" });
  });
  it("usa o e-mail quando não há metadados", () => {
    expect(profileFromUser({ email: "maria_silva99@exemplo.com" }).name).toBe("Maria");
  });
  it("não inventa nome sem dados válidos", () => {
    expect(profileFromUser(null)).toEqual({ name: null, initial: "•" });
    expect(profileFromUser({ email: "1234@exemplo.com" }).name).toBeNull();
  });
  it("não trata entradas arbitrárias de metadados como nomes", () => {
    expect(profileFromUser({ email: "joao@example.com", user_metadata: { full_name: 42 } }))
      .toEqual({ name: "Joao", initial: "J" });
  });
});
