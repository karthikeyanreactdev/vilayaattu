"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProfileForm } from "@/components/forms/ProfileForm";
import { useAppDispatch, useAppSelector } from "@/store";
import { setProfile } from "@/store/slices/userSlice";
import { useSound } from "@/hooks/useSound";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First-run mode can't be dismissed without a name. */
  required?: boolean;
  onSaved?: () => void;
};

export function ProfileDialog({ open, onOpenChange, required, onSaved }: Props) {
  const user = useAppSelector((s) => s.user);
  const dispatch = useAppDispatch();
  const play = useSound();

  return (
    <Dialog open={open} onOpenChange={(o) => (!required || user.name ? onOpenChange(o) : undefined)}>
      <DialogContent showCloseButton={!required} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{required ? "Vanakkam! 🙏" : "Your profile"}</DialogTitle>
          <DialogDescription>
            {required ? "What should your friends call you? No sign-up needed." : "Change your name or avatar."}
          </DialogDescription>
        </DialogHeader>
        <ProfileForm
          initial={{ name: user.name, avatar: user.avatar }}
          submitLabel={required ? "Let's play" : "Save"}
          onSubmit={(values) => {
            dispatch(setProfile(values));
            play("join");
            onOpenChange(false);
            onSaved?.();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
