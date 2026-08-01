import { Faq } from "@/components/faq";
import { Hero } from "@/components/hero/hero";
import { SiteFooter } from "@/components/site-footer";
import { StructuredData } from "@/components/structured-data";

export default function Home() {
  return (
    <>
      <StructuredData />
      <Hero />
      <Faq />
      <SiteFooter />
    </>
  );
}
