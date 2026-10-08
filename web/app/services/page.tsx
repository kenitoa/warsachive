import { ArchiveFooter, ArchiveShell } from "../components/archive-shell";
import { InstitutionServices } from "../components/expansion-services";
import { makePageMetadata } from "../site-config";
export const metadata = { ...makePageMetadata("기관 서비스와 주문", "실제 등록된 기관 상품과 서버에서 확인한 주문 상태를 제공합니다.", "/services/"), robots: { index: false, follow: true } };
export default function ServicesPage() { return <ArchiveShell pageClassName="servicesRoute"><section className="routeIntro"><p className="routeEyebrow">INSTITUTION / VERIFIED ORDERS</p><h1>필요한 서비스를 살피고,<br />확인된 상태로 진행합니다.</h1><p>기본 자료 열람은 무료로 유지합니다. 결제와 주문은 실제 공급자 및 서버의 상태 확인이 연결된 경우만 제공합니다.</p></section><section className="routeContent"><InstitutionServices /></section><ArchiveFooter /></ArchiveShell>; }
