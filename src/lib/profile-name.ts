export type Profile = { name: string | null; initial: string };

type UserLike = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined;

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1);
}

/** Identidade EXCLUSIVAMENTE de exibição, nunca para autorização ou RLS. */
export function profileFromUser(user: UserLike): Profile {
  const meta = user?.user_metadata ?? {};
  const fullName = [meta["full_name"], meta["name"], meta["given_name"]].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  let first = "";
  if (fullName) {
    first = fullName.trim().split(/\s+/)[0] ?? "";
  } else if (user?.email) {
    first = (user.email.split("@")[0] ?? "").split(/[._+-]+/)[0] ?? "";
    first = first.replace(/\d+$/, "");
  }
  first = first.trim().slice(0, 40);
  if (!first) return { name: null, initial: "•" };
  const name = capitalize(first);
  return { name, initial: name.charAt(0) };
}
