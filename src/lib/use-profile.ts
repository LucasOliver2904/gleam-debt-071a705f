import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { profileFromUser, type Profile } from "./profile-name";

const EMPTY: Profile = { name: null, initial: "•" };

/** Nome/avatar da sessão atual; não altera valores ou dados do usuário. */
export function useProfile(): Profile {
  const [profile, setProfile] = useState<Profile>(EMPTY);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setProfile(profileFromUser(data.session?.user));
    }).catch(() => {
      if (active) setProfile(EMPTY);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setProfile(profileFromUser(session?.user));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return profile;
}
