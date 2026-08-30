"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ComingSoonPageProps {
  title: string;
  description: string;
  icon: LucideIcon;
  features: string[];
  relatedHref?: string;
  relatedLabel?: string;
}

export function ComingSoonPage({
  title,
  description,
  icon: Icon,
  features,
  relatedHref,
  relatedLabel,
}: ComingSoonPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description}>
        <Badge variant="secondary" className="font-semibold">
          Coming soon
        </Badge>
      </PageHeader>

      <EmptyState
        icon={Icon}
        title={`${title} is on the roadmap`}
        description="This page is a UI placeholder while we wire up the voice agent APIs below."
        action={
          relatedHref && relatedLabel ? (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href={relatedHref}>
                {relatedLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-6 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature}
              className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm"
            >
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span className="font-medium text-muted-foreground">{feature}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
