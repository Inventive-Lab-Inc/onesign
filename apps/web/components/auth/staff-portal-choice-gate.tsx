"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { StaffPortalChoiceModal } from "@/components/auth/staff-portal-choice-modal";
import { getStaffPortalChoice } from "@/lib/auth/staff-portal-choice";

interface StaffPortalChoiceGateProps {
  isStaff: boolean;
  children: React.ReactNode;
}

export function StaffPortalChoiceGate({ isStaff, children }: StaffPortalChoiceGateProps) {
  const pathname = usePathname();
  const [showChoice, setShowChoice] = useState(false);

  useEffect(() => {
    if (!isStaff) {
      setShowChoice(false);
      return;
    }

    const existingChoice = getStaffPortalChoice();
    if (existingChoice) {
      setShowChoice(false);
      return;
    }

    setShowChoice(true);
  }, [isStaff, pathname]);

  return (
    <>
      {children}
      {showChoice ? (
        <StaffPortalChoiceModal onChooseUser={() => setShowChoice(false)} />
      ) : null}
    </>
  );
}
