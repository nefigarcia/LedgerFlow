"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageUp, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  removeLogoAction,
  updateOrganizationProfileAction,
  uploadLogoAction,
} from "@/features/organizations/branding-actions";
import { initials } from "@/lib/utils";

interface ProfileOrg {
  name: string;
  legalName: string;
  taxIdLastFour: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressState: string;
  addressPostalCode: string;
  addressCountry: string;
  phone: string;
  website: string;
}

const MAX_BYTES = 2 * 1024 * 1024;

export function ProfileSettings({
  organizationSlug,
  org,
  logoSrc,
  canEdit,
  storageReady,
}: {
  organizationSlug: string;
  org: ProfileOrg;
  logoSrc: string | null;
  canEdit: boolean;
  storageReady: boolean;
}) {
  return (
    <div className="space-y-4">
      <LogoCard
        organizationSlug={organizationSlug}
        name={org.name}
        logoSrc={logoSrc}
        canEdit={canEdit}
        storageReady={storageReady}
      />
      <ProfileCard organizationSlug={organizationSlug} org={org} canEdit={canEdit} />
    </div>
  );
}

function LogoCard({
  organizationSlug,
  name,
  logoSrc,
  canEdit,
  storageReady,
}: {
  organizationSlug: string;
  name: string;
  logoSrc: string | null;
  canEdit: boolean;
  storageReady: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);

  function onPick(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error("Logo must be a PNG or JPEG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Logo must be 2 MB or smaller.");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    const fd = new FormData();
    fd.set("logo", file);
    start(async () => {
      const res = await uploadLogoAction(organizationSlug, fd);
      URL.revokeObjectURL(localUrl);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      if (!res.success) { toast.error(res.error.message); return; }
      toast.success("Logo updated");
      router.refresh();
    });
  }

  const shown = preview ?? logoSrc;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo</CardTitle>
        <p className="text-xs text-muted-foreground">Shown in the sidebar and printed on invoice PDFs.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!storageReady ? (
          <Alert variant="warning">
            <AlertDescription className="text-xs">
              File storage isn&apos;t configured on this server. Set <code>STORAGE_DRIVER=s3</code>, <code>S3_BUCKET</code> and
              <code> S3_REGION</code> to enable uploads.
            </AlertDescription>
          </Alert>
        ) : null}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid h-20 w-40 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-sunken">
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shown} alt={`${name} logo`} className="max-h-16 max-w-[9rem] object-contain" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                {initials(name)}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0])}
                aria-label="Upload logo"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!canEdit || pending || !storageReady}
                onClick={() => inputRef.current?.click()}
              >
                <ImageUp className="h-4 w-4" /> {pending ? "Uploading…" : logoSrc ? "Replace logo" : "Upload logo"}
              </Button>
              {logoSrc ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canEdit || pending}
                  onClick={() => {
                    if (!confirm("Remove the logo from this workspace and future invoice PDFs?")) return;
                    start(async () => {
                      const res = await removeLogoAction(organizationSlug);
                      if (!res.success) { toast.error(res.error.message); return; }
                      toast.success("Logo removed");
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              ) : null}
            </div>
            <p className="text-2xs text-muted-foreground">
              PNG or JPEG, up to 2 MB. A wide logo on a transparent or white background works best (about 600 × 200 px).
            </p>
            {!canEdit ? <p className="text-2xs text-muted-foreground">Only owners and admins can change branding.</p> : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileCard({ organizationSlug, org, canEdit }: { organizationSlug: string; org: ProfileOrg; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business details</CardTitle>
        <p className="text-xs text-muted-foreground">Printed in the header of your invoices.</p>
      </CardHeader>
      <CardContent>
        <form
          className="grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setErrors({});
            start(async () => {
              const res = await updateOrganizationProfileAction(organizationSlug, fd);
              if (!res.success) {
                if (res.error.fieldErrors) {
                  const flat: Record<string, string> = {};
                  for (const k in res.error.fieldErrors) flat[k] = res.error.fieldErrors[k][0];
                  setErrors(flat);
                }
                toast.error(res.error.message);
                return;
              }
              toast.success("Business details saved");
              router.refresh();
            });
          }}
        >
          <fieldset disabled={!canEdit || pending} className="contents">
            <Field label="Business name" required error={errors.name}>
              <Input name="name" defaultValue={org.name} maxLength={120} required />
            </Field>
            <Field label="Legal name" error={errors.legalName}>
              <Input name="legalName" defaultValue={org.legalName} maxLength={200} />
            </Field>
            <Field label="Address line 1" className="md:col-span-2" error={errors.addressLine1}>
              <Input name="addressLine1" defaultValue={org.addressLine1} maxLength={200} />
            </Field>
            <Field label="Address line 2" className="md:col-span-2" error={errors.addressLine2}>
              <Input name="addressLine2" defaultValue={org.addressLine2} maxLength={200} />
            </Field>
            <Field label="City" error={errors.addressCity}>
              <Input name="addressCity" defaultValue={org.addressCity} maxLength={120} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="State / region" error={errors.addressState}>
                <Input name="addressState" defaultValue={org.addressState} maxLength={80} />
              </Field>
              <Field label="Postal code" error={errors.addressPostalCode}>
                <Input name="addressPostalCode" defaultValue={org.addressPostalCode} maxLength={20} />
              </Field>
            </div>
            <Field label="Country" error={errors.addressCountry}>
              <Input name="addressCountry" defaultValue={org.addressCountry} maxLength={80} />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input name="phone" type="tel" defaultValue={org.phone} maxLength={40} />
            </Field>
            <Field label="Website" error={errors.website}>
              <Input name="website" defaultValue={org.website} maxLength={200} placeholder="https://" />
            </Field>
            <Field label="Tax ID (last four)" error={errors.taxIdLastFour} hint="Only the last four digits are stored.">
              <Input name="taxIdLastFour" defaultValue={org.taxIdLastFour} maxLength={4} inputMode="numeric" />
            </Field>
            <div className="flex justify-end md:col-span-2">
              <Button type="submit" disabled={!canEdit || pending}>{pending ? "Saving…" : "Save details"}</Button>
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}
