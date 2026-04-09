import asyncio
import sys
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.models.models import (
    CategoriaFornitore,
    Cliente,
    CoefficienteAllocazione,
    Commessa,
    CommessaProgetto,
    CommessaStatus,
    CostoFisso,
    FatturaAttiva,
    FatturaPassiva,
    FatturaPassivaImputazione,
    Fornitore,
    MovimentoCassa,
    ProjectStatus,
    ProjectType,
    Progetto,
    Task,
    TaskStatus,
    Timesheet,
    TimesheetStatus,
    User,
    UserRole,
)


DEMO_REFERENCE_TODAY = date(2026, 4, 8)
MONEY = Decimal("0.01")


def month(year: int, month_number: int) -> date:
    return date(year, month_number, 1)


def as_money(value: Decimal | float | int | str) -> Decimal:
    return Decimal(str(value)).quantize(MONEY, rounding=ROUND_HALF_UP)


def with_day(month_date: date, day: int) -> date:
    return month_date.replace(day=min(max(day, 1), 28))


def month_label(value: date) -> str:
    return value.strftime("%Y-%m")


def demo_password_hash() -> str:
    return "demo-seed-password-hash"


def project(
    slug: str,
    name: str,
    kind: str,
    fixed: str,
    variable: str,
    delivery_attesa: int,
    project_type: ProjectType = ProjectType.RETAINER,
) -> dict:
    return {
        "slug": slug,
        "name": name,
        "kind": kind,
        "type": project_type,
        "fixed": as_money(fixed),
        "variable": as_money(variable),
        "delivery_attesa": delivery_attesa,
    }


def row(project_slug: str, delivery_consuntiva: int) -> dict:
    return {"project": project_slug, "delivery_consuntiva": delivery_consuntiva}


def commessa(
    *,
    month_date: date,
    status: CommessaStatus,
    hours: str,
    direct: str,
    rows: list[dict],
    note: str,
    billing: str = "NONE",
) -> dict:
    return {
        "month": month_date,
        "status": status,
        "hours": Decimal(str(hours)),
        "direct": as_money(direct),
        "rows": rows,
        "note": note,
        "billing": billing,
    }


MONTH_COEFFICIENTS = {
    month(2025, 11): Decimal("0.27"),
    month(2025, 12): Decimal("0.28"),
    month(2026, 1): Decimal("0.29"),
    month(2026, 2): Decimal("0.30"),
    month(2026, 3): Decimal("0.31"),
    month(2026, 4): Decimal("0.32"),
}


DEMO_TEAM = [
    {
        "email": "bianca.riva@bite-demo.local",
        "nome": "Bianca",
        "cognome": "Riva",
        "ruolo": UserRole.ADMIN,
        "costo_orario": as_money("60"),
        "ore_settimanali": 40,
        "aliases": ["approver", "director"],
    },
    {
        "email": "andrea.rossi@bite-demo.local",
        "nome": "Andrea",
        "cognome": "Rossi",
        "ruolo": UserRole.PM,
        "costo_orario": as_money("44"),
        "ore_settimanali": 40,
        "aliases": ["pm", "account"],
    },
    {
        "email": "elisa.conti@bite-demo.local",
        "nome": "Elisa",
        "cognome": "Conti",
        "ruolo": UserRole.DIPENDENTE,
        "costo_orario": as_money("31"),
        "ore_settimanali": 40,
        "aliases": ["content", "social"],
    },
    {
        "email": "matteo.galli@bite-demo.local",
        "nome": "Matteo",
        "cognome": "Galli",
        "ruolo": UserRole.DIPENDENTE,
        "costo_orario": as_money("36"),
        "ore_settimanali": 40,
        "aliases": ["performance", "ads", "seo"],
    },
    {
        "email": "chiara.neri@bite-demo.local",
        "nome": "Chiara",
        "cognome": "Neri",
        "ruolo": UserRole.DIPENDENTE,
        "costo_orario": as_money("34"),
        "ore_settimanali": 40,
        "aliases": ["design", "brand"],
    },
    {
        "email": "luca.greco@bite-demo.local",
        "nome": "Luca",
        "cognome": "Greco",
        "ruolo": UserRole.FREELANCER,
        "costo_orario": as_money("48"),
        "ore_settimanali": 32,
        "aliases": ["dev", "automation", "web"],
    },
    {
        "email": "giorgia.marini@bite-demo.local",
        "nome": "Giorgia",
        "cognome": "Marini",
        "ruolo": UserRole.FREELANCER,
        "costo_orario": as_money("46"),
        "ore_settimanali": 24,
        "aliases": ["photo", "video"],
    },
]


TASK_BLUEPRINTS = {
    "SOCIAL": [
        {"slug": "plan", "title": "Piano editoriale", "service": "Piano editoriale", "alias": "content", "share": Decimal("0.30"), "due_day": 5},
        {"slug": "content", "title": "Produzione contenuti", "service": "Produzione contenuti", "alias": "design", "share": Decimal("0.45"), "due_day": 12},
        {"slug": "report", "title": "Report performance", "service": "Report performance", "alias": "pm", "share": Decimal("0.25"), "due_day": 25},
    ],
    "ADS": [
        {"slug": "setup", "title": "Setup e gestione campagne", "service": "Gestione ADV", "alias": "ads", "share": Decimal("0.50"), "due_day": 6},
        {"slug": "creative", "title": "Creativita e test ads", "service": "Creativita ADV", "alias": "design", "share": Decimal("0.20"), "due_day": 13},
        {"slug": "report", "title": "Analisi CPA e ROAS", "service": "Reporting ADV", "alias": "pm", "share": Decimal("0.30"), "due_day": 24},
    ],
    "WEB": [
        {"slug": "ux", "title": "UX e architettura", "service": "UX/UI", "alias": "design", "share": Decimal("0.25"), "due_day": 7},
        {"slug": "build", "title": "Sviluppo e rilascio", "service": "Sviluppo web", "alias": "dev", "share": Decimal("0.55"), "due_day": 16},
        {"slug": "qa", "title": "QA e validazione", "service": "QA e pubblicazione", "alias": "pm", "share": Decimal("0.20"), "due_day": 25},
    ],
    "SEO": [
        {"slug": "audit", "title": "Audit e priorita SEO", "service": "Audit SEO", "alias": "seo", "share": Decimal("0.40"), "due_day": 5},
        {"slug": "optimization", "title": "Ottimizzazioni on-page", "service": "Ottimizzazione SEO", "alias": "seo", "share": Decimal("0.35"), "due_day": 14},
        {"slug": "report", "title": "Monitoraggio keyword", "service": "Report SEO", "alias": "pm", "share": Decimal("0.25"), "due_day": 25},
    ],
    "CRM": [
        {"slug": "flow", "title": "Setup flussi automazione", "service": "CRM automation", "alias": "automation", "share": Decimal("0.45"), "due_day": 8},
        {"slug": "copy", "title": "Copy email e nurture", "service": "Copy CRM", "alias": "content", "share": Decimal("0.25"), "due_day": 15},
        {"slug": "report", "title": "Analisi funnel e open rate", "service": "Report CRM", "alias": "pm", "share": Decimal("0.30"), "due_day": 25},
    ],
    "BRAND": [
        {"slug": "workshop", "title": "Workshop strategico", "service": "Strategia brand", "alias": "pm", "share": Decimal("0.20"), "due_day": 6},
        {"slug": "visual", "title": "Concept e asset visual", "service": "Brand design", "alias": "brand", "share": Decimal("0.55"), "due_day": 16},
        {"slug": "guidelines", "title": "Linee guida e handoff", "service": "Handoff creativo", "alias": "content", "share": Decimal("0.25"), "due_day": 25},
    ],
    "PHOTO": [
        {"slug": "script", "title": "Moodboard e scaletta shooting", "service": "Pre-produzione", "alias": "pm", "share": Decimal("0.20"), "due_day": 4},
        {"slug": "shoot", "title": "Shooting foto/video", "service": "Produzione shooting", "alias": "photo", "share": Decimal("0.55"), "due_day": 11},
        {"slug": "edit", "title": "Selezione e consegna asset", "service": "Post-produzione", "alias": "design", "share": Decimal("0.25"), "due_day": 20},
    ],
}


DEMO_CLIENTS = [
    {
        "code": "ALB",
        "name": "Alba Ristorazione S.r.l.",
        "email": "operations@albaristorazione.it",
        "referente": "Giulia Ferri",
        "affidabilita": "ALTA",
        "comune": "Milano",
        "provincia": "MI",
        "tipologia": "Hospitality",
        "payment_terms": "30 giorni data fattura",
        "note": "Gruppo food con delivery, eventi e apertura nuovi punti vendita.",
        "projects": [
            project("social", "Gestione profili social", "SOCIAL", "650", "220", 8),
            project("ads", "Campagne ADV local store", "ADS", "780", "380", 6),
        ],
        "commesse": [
            commessa(month_date=month(2026, 1), status=CommessaStatus.INCASSATA, hours="32", direct="190", rows=[row("social", 8), row("ads", 5)], note="Retainer Q1 con focus delivery e awareness locali.", billing="PAID"),
            commessa(month_date=month(2026, 2), status=CommessaStatus.FATTURATA, hours="30", direct="170", rows=[row("social", 7), row("ads", 4)], note="Campagna San Valentino e refresh content ristorante premium.", billing="PARTIAL"),
            commessa(month_date=month(2026, 3), status=CommessaStatus.INCASSATA, hours="34", direct="210", rows=[row("social", 8), row("ads", 6)], note="Spinta eventi primavera e promozione brunch weekend.", billing="PAID"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.PRONTA_CHIUSURA, hours="33", direct="200", rows=[row("social", 7), row("ads", 5)], note="Nuovo piano editoriale estate con campagne geo-localizzate.", billing="NONE"),
        ],
    },
    {
        "code": "VNT",
        "name": "Vento Moda S.p.A.",
        "email": "marketing@ventomoda.it",
        "referente": "Serena Riva",
        "affidabilita": "ALTA",
        "comune": "Verona",
        "provincia": "VR",
        "tipologia": "Fashion",
        "payment_terms": "30 giorni data fattura",
        "note": "Brand fashion con capsule collection stagionali e retail fisico.",
        "projects": [
            project("social", "Retainer social premium", "SOCIAL", "980", "280", 6),
            project("shoot", "Shooting capsule collection", "PHOTO", "1200", "0", 1, ProjectType.ONE_OFF),
        ],
        "commesse": [
            commessa(month_date=month(2025, 12), status=CommessaStatus.INCASSATA, hours="26", direct="320", rows=[row("social", 6)], note="Campagna gifting e contenuti holiday per e-commerce.", billing="PAID"),
            commessa(month_date=month(2026, 2), status=CommessaStatus.CHIUSA, hours="36", direct="640", rows=[row("social", 5), row("shoot", 1)], note="Spring drop con shooting studio e piano contenuti dedicato.", billing="DUE"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.FATTURATA, hours="29", direct="260", rows=[row("social", 6)], note="Go live collezione SS26 con piano editoriale ad alta frequenza.", billing="PARTIAL"),
        ],
    },
    {
        "code": "MTR",
        "name": "Motori Nord S.r.l.",
        "email": "crm@motorinord.it",
        "referente": "Alessandro Gori",
        "affidabilita": "MEDIA",
        "comune": "Bergamo",
        "provincia": "BG",
        "tipologia": "Automotive",
        "payment_terms": "45 giorni data fattura",
        "note": "Dealer multi-brand con focus lead generation veicoli usati e noleggio.",
        "projects": [
            project("leadgen", "Lead generation automotive", "ADS", "1250", "620", 8),
            project("landing", "Landing page promo usato", "WEB", "980", "0", 1, ProjectType.ONE_OFF),
        ],
        "commesse": [
            commessa(month_date=month(2026, 2), status=CommessaStatus.FATTURATA, hours="31", direct="280", rows=[row("leadgen", 6)], note="Campagne search e Meta per stock usato garantito.", billing="PARTIAL"),
            commessa(month_date=month(2026, 3), status=CommessaStatus.INCASSATA, hours="35", direct="300", rows=[row("leadgen", 8), row("landing", 1)], note="Rilascio landing dedicata e aumento budget su lead caldi.", billing="PAID"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.APERTA, hours="28", direct="220", rows=[row("leadgen", 5)], note="Piano Q2 su remarketing e test campagne noleggio lungo termine.", billing="NONE"),
        ],
    },
    {
        "code": "NVA",
        "name": "Nova Clinic STP",
        "email": "direzione@novaclinic.it",
        "referente": "Martina Sala",
        "affidabilita": "ALTA",
        "comune": "Bologna",
        "provincia": "BO",
        "tipologia": "Healthcare",
        "payment_terms": "30 giorni data fattura",
        "note": "Poliambulatorio specialistico con crescita su chirurgia estetica e dermatologia.",
        "projects": [
            project("brand", "Brand awareness medico", "BRAND", "1450", "260", 5),
            project("seo", "SEO specialistica clinica", "SEO", "760", "240", 6),
        ],
        "commesse": [
            commessa(month_date=month(2026, 1), status=CommessaStatus.INCASSATA, hours="27", direct="140", rows=[row("brand", 5)], note="Campagna reputazione medico-specialistica su servizi premium.", billing="PAID"),
            commessa(month_date=month(2026, 3), status=CommessaStatus.CHIUSA, hours="24", direct="130", rows=[row("brand", 4), row("seo", 5)], note="Bilanciamento awareness e crescita organica local SEO.", billing="DUE"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.FATTURATA, hours="26", direct="145", rows=[row("brand", 4), row("seo", 4)], note="Mese stabile con nuovi contenuti reputazionali e ottimizzazioni schede.", billing="PARTIAL"),
        ],
    },
    {
        "code": "LMN",
        "name": "Lumen Home Design S.r.l.",
        "email": "hello@lumenhome.it",
        "referente": "Federica Milani",
        "affidabilita": "ALTA",
        "comune": "Monza",
        "provincia": "MB",
        "tipologia": "Interior & Ecommerce",
        "payment_terms": "30 giorni data fattura",
        "note": "Brand arredamento con focus ecommerce, CRM e catalogo nuovi lanci.",
        "projects": [
            project("ecommerce", "Manutenzione ecommerce", "WEB", "1480", "420", 5),
            project("automation", "Email automation retail", "CRM", "920", "210", 5),
        ],
        "commesse": [
            commessa(month_date=month(2026, 1), status=CommessaStatus.INCASSATA, hours="33", direct="180", rows=[row("ecommerce", 4), row("automation", 5)], note="Ottimizzazione shop e flussi carrello abbandonato post saldi.", billing="PAID"),
            commessa(month_date=month(2026, 2), status=CommessaStatus.FATTURATA, hours="31", direct="160", rows=[row("ecommerce", 5), row("automation", 4)], note="Nuove sequenze CRM e rilascio fix checkout mobile.", billing="PAID"),
            commessa(month_date=month(2026, 3), status=CommessaStatus.INCASSATA, hours="34", direct="195", rows=[row("ecommerce", 5), row("automation", 5)], note="Boost spring collection con email segmentation avanzata.", billing="PAID"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.APERTA, hours="30", direct="150", rows=[row("ecommerce", 4), row("automation", 3)], note="Priorita su performance category page e newsletter lancio outdoor.", billing="NONE"),
        ],
    },
    {
        "code": "RFD",
        "name": "Riviera Food Lab S.r.l.",
        "email": "growth@rivieralab.it",
        "referente": "Paolo Conti",
        "affidabilita": "MEDIA",
        "comune": "Genova",
        "provincia": "GE",
        "tipologia": "Food Retail",
        "payment_terms": "30 giorni data fattura",
        "note": "Laboratorio food con focus retail, attivazioni trade e storytelling prodotto.",
        "projects": [
            project("retail", "Trade marketing retail", "SOCIAL", "1120", "360", 6),
        ],
        "commesse": [
            commessa(month_date=month(2025, 11), status=CommessaStatus.INCASSATA, hours="22", direct="120", rows=[row("retail", 6)], note="Campagna sell-in autunno con supporto trade per GDO locale.", billing="PAID"),
            commessa(month_date=month(2026, 1), status=CommessaStatus.CHIUSA, hours="24", direct="135", rows=[row("retail", 5)], note="Lancio limited edition con calendario contenuti e materiali POP.", billing="PAID"),
            commessa(month_date=month(2026, 3), status=CommessaStatus.FATTURATA, hours="26", direct="145", rows=[row("retail", 5)], note="Presidio retail primavera e supporto campagna sampling.", billing="DUE"),
        ],
    },
    {
        "code": "CVR",
        "name": "Citta Verde Resort S.r.l.",
        "email": "booking@cittaverderesort.it",
        "referente": "Irene Pavesi",
        "affidabilita": "ALTA",
        "comune": "Siena",
        "provincia": "SI",
        "tipologia": "Hospitality",
        "payment_terms": "30 giorni data fattura",
        "note": "Resort leisure con booking funnel stagionale e produzione visual per camere.",
        "projects": [
            project("booking", "Booking funnel estate", "ADS", "1380", "520", 7),
            project("shoot", "Shooting camere e experience", "PHOTO", "920", "0", 1, ProjectType.ONE_OFF),
        ],
        "commesse": [
            commessa(month_date=month(2026, 2), status=CommessaStatus.FATTURATA, hours="29", direct="240", rows=[row("booking", 6)], note="Riapertura booking con focus early bird soggiorni lunghi.", billing="PAID"),
            commessa(month_date=month(2026, 3), status=CommessaStatus.INCASSATA, hours="37", direct="540", rows=[row("booking", 7), row("shoot", 1)], note="Produzione shooting camere e ottimizzazione pacchetti primavera.", billing="PAID"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.PRONTA_CHIUSURA, hours="30", direct="250", rows=[row("booking", 5)], note="Campagne lookalike e aggiornamento offerte pasqua-estate.", billing="NONE"),
        ],
    },
    {
        "code": "FLX",
        "name": "Fenix Logistics Italia S.r.l.",
        "email": "sales@fenixlogistics.it",
        "referente": "Davide Marino",
        "affidabilita": "MEDIA",
        "comune": "Padova",
        "provincia": "PD",
        "tipologia": "B2B",
        "payment_terms": "45 giorni data fattura",
        "note": "Operatore logistico B2B con obiettivo acquisizione contatti commerciali qualificati.",
        "projects": [
            project("b2b", "Lead generation B2B", "ADS", "1520", "640", 8),
            project("seo", "SEO verticale logistica", "SEO", "680", "210", 5),
        ],
        "commesse": [
            commessa(month_date=month(2026, 1), status=CommessaStatus.INCASSATA, hours="28", direct="160", rows=[row("b2b", 6)], note="Avvio pipeline lead per trasporti refrigerati e pharma.", billing="PAID"),
            commessa(month_date=month(2026, 3), status=CommessaStatus.FATTURATA, hours="30", direct="180", rows=[row("b2b", 7), row("seo", 4)], note="Espansione keyword industriali e webinar commerciale dedicato.", billing="PARTIAL"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.APERTA, hours="27", direct="150", rows=[row("b2b", 4), row("seo", 3)], note="Focus su nurturing lead e contenuti verticali per procurement.", billing="NONE"),
        ],
    },
    {
        "code": "CLB",
        "name": "Cloud Lab Academy S.r.l.",
        "email": "marketing@cloudlabacademy.it",
        "referente": "Tommaso Righi",
        "affidabilita": "ALTA",
        "comune": "Torino",
        "provincia": "TO",
        "tipologia": "Education",
        "payment_terms": "30 giorni data fattura",
        "note": "Academy digitale con funnel webinar, landing corsi e piano editoriale formativo.",
        "projects": [
            project("site", "Sito corsi e landing webinar", "WEB", "2100", "0", 1, ProjectType.ONE_OFF),
            project("editoriale", "Piano editoriale corsi", "SOCIAL", "760", "240", 6),
        ],
        "commesse": [
            commessa(month_date=month(2025, 11), status=CommessaStatus.INCASSATA, hours="34", direct="120", rows=[row("site", 1)], note="Setup architettura nuovo sito academy con landing lead magnet.", billing="PAID"),
            commessa(month_date=month(2025, 12), status=CommessaStatus.INCASSATA, hours="29", direct="100", rows=[row("site", 1)], note="Rilascio sito corsi con moduli iscrizione e tracking webinar.", billing="PAID"),
            commessa(month_date=month(2026, 2), status=CommessaStatus.FATTURATA, hours="24", direct="110", rows=[row("editoriale", 5)], note="Piano editoriale lezioni live e nurture studenti prossima intake.", billing="PAID"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.APERTA, hours="23", direct="95", rows=[row("editoriale", 4)], note="Contenuti promozione bootcamp estivo e webinar di enrollment.", billing="NONE"),
        ],
    },
    {
        "code": "AUR",
        "name": "Aurora Real Estate S.r.l.",
        "email": "growth@aurorare.it",
        "referente": "Valeria Testa",
        "affidabilita": "MEDIA",
        "comune": "Roma",
        "provincia": "RM",
        "tipologia": "Real Estate",
        "payment_terms": "30 giorni data fattura",
        "note": "Boutique real estate con campagne lead per nuove costruzioni e luxury rent.",
        "projects": [
            project("landing", "Landing page cantiere", "WEB", "1340", "0", 1, ProjectType.ONE_OFF),
            project("ads", "Campagne lead immobiliari", "ADS", "910", "320", 6),
        ],
        "commesse": [
            commessa(month_date=month(2026, 2), status=CommessaStatus.CHIUSA, hours="28", direct="180", rows=[row("landing", 1), row("ads", 4)], note="Lancio nuovo cantiere con landing dedicata e campagne Meta lead.", billing="PAID"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.FATTURATA, hours="26", direct="210", rows=[row("ads", 5)], note="Campagne luxury rent con ottimizzazione CPL e nuovi visual.", billing="PARTIAL"),
        ],
    },
    {
        "code": "OWW",
        "name": "Orizzonte Wellness Club",
        "email": "marketing@orizzontewellness.it",
        "referente": "Barbara Leoni",
        "affidabilita": "BASSA",
        "comune": "Parma",
        "provincia": "PR",
        "tipologia": "Fitness",
        "payment_terms": "30 giorni data fattura",
        "note": "Centro wellness con forte stagionalita e test su promozioni abbonamenti.",
        "projects": [
            project("social", "Retainer social fitness", "SOCIAL", "720", "210", 6),
            project("maintenance", "Manutenzione sito e promo", "WEB", "430", "110", 4),
        ],
        "commesse": [
            commessa(month_date=month(2026, 3), status=CommessaStatus.FATTURATA, hours="20", direct="90", rows=[row("social", 5), row("maintenance", 3)], note="Promo spring membership con landing promo e community management.", billing="DUE"),
            commessa(month_date=month(2026, 4), status=CommessaStatus.APERTA, hours="18", direct="85", rows=[row("social", 4), row("maintenance", 2)], note="Test campagna referral e aggiornamenti calendario corsi online.", billing="NONE"),
        ],
    },
]


DEMO_FIXED_COSTS = [
    {"descrizione": "Affitto studio Milano Porta Romana", "importo": as_money("2200"), "categoria": "STRUTTURA", "periodicita": "mensile", "data_inizio": date(2025, 1, 1), "note": "Showroom, ufficio operativo e sala riunioni."},
    {"descrizione": "Adobe Creative Cloud Team", "importo": as_money("329"), "categoria": "SOFTWARE", "periodicita": "mensile", "data_inizio": date(2025, 1, 1), "note": "Licenze creative team design e video."},
    {"descrizione": "HubSpot Starter + CRM", "importo": as_money("145"), "categoria": "SOFTWARE", "periodicita": "mensile", "data_inizio": date(2025, 6, 1), "note": "CRM commerciale e funnel marketing."},
    {"descrizione": "Google Workspace", "importo": as_money("96"), "categoria": "SOFTWARE", "periodicita": "mensile", "data_inizio": date(2025, 1, 1), "note": "Mail e drive del team."},
    {"descrizione": "Commercialista e payroll", "importo": as_money("480"), "categoria": "AMMINISTRAZIONE", "periodicita": "mensile", "data_inizio": date(2025, 1, 1), "note": "Contabilita ordinaria e paghe."},
    {"descrizione": "Assicurazione RC professionale", "importo": as_money("1200"), "categoria": "ASSICURAZIONE", "periodicita": "annuale", "data_inizio": date(2026, 1, 1), "note": "Polizza annuale studio e responsabilita professionale."},
    {"descrizione": "Leasing attrezzatura foto/video", "importo": as_money("1500"), "categoria": "LEASING", "periodicita": "semestrale", "data_inizio": date(2025, 11, 1), "note": "Camera, lenti e kit luci per produzione contenuti."},
    {"descrizione": "Stack AI e automazione", "importo": as_money("245"), "categoria": "SOFTWARE", "periodicita": "mensile", "data_inizio": date(2025, 10, 1), "note": "Tool AI, automazioni interne e insight reporting."},
]


DEMO_SUPPLIER_CATEGORIES = [
    {"name": "Advertising", "color": "#3b82f6"},
    {"name": "Produzione", "color": "#f97316"},
    {"name": "Software", "color": "#10b981"},
    {"name": "Hosting", "color": "#8b5cf6"},
    {"name": "Freelance", "color": "#ec4899"},
]


DEMO_SUPPLIERS = [
    {"slug": "meta", "name": "Meta Platforms Ireland Ltd", "category": "Advertising", "email": "billing@meta.com", "telefono": "+35300000001"},
    {"slug": "google", "name": "Google Ireland Limited", "category": "Advertising", "email": "ads-noreply@google.com", "telefono": "+35300000002"},
    {"slug": "frame", "name": "Frame Studio S.r.l.", "category": "Produzione", "email": "amministrazione@framestudio.it", "telefono": "+390200000001"},
    {"slug": "motion", "name": "Motion Craft Lab", "category": "Produzione", "email": "billing@motioncraftlab.it", "telefono": "+390200000002"},
    {"slug": "devops", "name": "DevOps Cloud Europe", "category": "Hosting", "email": "finance@devopscloud.eu", "telefono": "+390200000003"},
    {"slug": "copylab", "name": "CopyLab Freelance Network", "category": "Freelance", "email": "amministrazione@copylab.it", "telefono": "+390200000004"},
    {"slug": "activecampaign", "name": "ActiveCampaign Europe", "category": "Software", "email": "finance@activecampaign.com", "telefono": "+35300000003"},
    {"slug": "print", "name": "Print Hub Italia", "category": "Produzione", "email": "ordini@printhub.it", "telefono": "+390200000005"},
]


DEMO_PASSIVE_INVOICES = [
    {"fic_id": "DEMO-FP-META-ALB-202601", "supplier": "meta", "cliente": "ALB", "project": "ads", "issue_date": date(2026, 1, 29), "due_date": date(2026, 2, 10), "net": as_money("390"), "iva": as_money("85.80"), "status": "PAGATA", "paid": as_money("475.80"), "description": "Budget Meta Ads gennaio per campagne delivery Alba."},
    {"fic_id": "DEMO-FP-META-ALB-202603", "supplier": "meta", "cliente": "ALB", "project": "ads", "issue_date": date(2026, 3, 29), "due_date": date(2026, 4, 10), "net": as_money("460"), "iva": as_money("101.20"), "status": "PAGATA", "paid": as_money("561.20"), "description": "Budget Meta Ads marzo per weekend brunch e catering."},
    {"fic_id": "DEMO-FP-META-AUR-202604", "supplier": "meta", "cliente": "AUR", "project": "ads", "issue_date": date(2026, 4, 5), "due_date": date(2026, 4, 20), "net": as_money("520"), "iva": as_money("114.40"), "status": "PARZIALE", "paid": as_money("300.00"), "description": "Budget Meta Ads aprile per luxury rent e lead immobiliari."},
    {"fic_id": "DEMO-FP-GGL-MTR-202602", "supplier": "google", "cliente": "MTR", "project": "leadgen", "issue_date": date(2026, 2, 27), "due_date": date(2026, 3, 12), "net": as_money("480"), "iva": as_money("105.60"), "status": "PAGATA", "paid": as_money("585.60"), "description": "Spesa Google Ads febbraio per stock usato premium."},
    {"fic_id": "DEMO-FP-GGL-MTR-202603", "supplier": "google", "cliente": "MTR", "project": "leadgen", "issue_date": date(2026, 3, 30), "due_date": date(2026, 4, 12), "net": as_money("540"), "iva": as_money("118.80"), "status": "PAGATA", "paid": as_money("658.80"), "description": "Spesa Google Ads marzo per keyword noleggio e usato garantito."},
    {"fic_id": "DEMO-FP-GGL-FLX-202603", "supplier": "google", "cliente": "FLX", "project": "b2b", "issue_date": date(2026, 3, 31), "due_date": date(2026, 4, 14), "net": as_money("610"), "iva": as_money("134.20"), "status": "PARZIALE", "paid": as_money("370.00"), "description": "Search industriale marzo per lead B2B logistica."},
    {"fic_id": "DEMO-FP-FRM-VNT-202602", "supplier": "frame", "cliente": "VNT", "project": "shoot", "issue_date": date(2026, 2, 18), "due_date": date(2026, 3, 5), "net": as_money("780"), "iva": as_money("171.60"), "status": "PAGATA", "paid": as_money("951.60"), "description": "Produzione shooting capsule collection SS26."},
    {"fic_id": "DEMO-FP-FRM-CVR-202603", "supplier": "frame", "cliente": "CVR", "project": "shoot", "issue_date": date(2026, 3, 17), "due_date": date(2026, 3, 31), "net": as_money("650"), "iva": as_money("143.00"), "status": "PAGATA", "paid": as_money("793.00"), "description": "Shooting camere e experience resort primavera."},
    {"fic_id": "DEMO-FP-DEV-LMN-202601", "supplier": "devops", "cliente": "LMN", "project": "ecommerce", "issue_date": date(2026, 1, 12), "due_date": date(2026, 1, 27), "net": as_money("190"), "iva": as_money("41.80"), "status": "PAGATA", "paid": as_money("231.80"), "description": "Hosting e CDN ecommerce Lumen Home gennaio."},
    {"fic_id": "DEMO-FP-DEV-OWW-202604", "supplier": "devops", "cliente": "OWW", "project": "maintenance", "issue_date": date(2026, 4, 4), "due_date": date(2026, 4, 19), "net": as_money("160"), "iva": as_money("35.20"), "status": "ATTESA", "paid": as_money("0"), "description": "Hosting e manutenzione promo wellness aprile."},
    {"fic_id": "DEMO-FP-CPL-CLB-202602", "supplier": "copylab", "cliente": "CLB", "project": "editoriale", "issue_date": date(2026, 2, 21), "due_date": date(2026, 3, 7), "net": as_money("320"), "iva": as_money("70.40"), "status": "PAGATA", "paid": as_money("390.40"), "description": "Copy webinar e nurture email academy intake primavera."},
    {"fic_id": "DEMO-FP-CPL-FLX-202604", "supplier": "copylab", "cliente": "FLX", "project": "seo", "issue_date": date(2026, 4, 2), "due_date": date(2026, 4, 17), "net": as_money("280"), "iva": as_money("61.60"), "status": "ATTESA", "paid": as_money("0"), "description": "Copy verticale logistica e casi studio per SEO aprile."},
    {"fic_id": "DEMO-FP-MTN-NVA-202603", "supplier": "motion", "cliente": "NVA", "project": "brand", "issue_date": date(2026, 3, 20), "due_date": date(2026, 4, 2), "net": as_money("540"), "iva": as_money("118.80"), "status": "PAGATA", "paid": as_money("658.80"), "description": "Motion graphics reputazione clinica e video servizi premium."},
    {"fic_id": "DEMO-FP-PRT-RFD-202511", "supplier": "print", "cliente": "RFD", "project": "retail", "issue_date": date(2025, 11, 16), "due_date": date(2025, 11, 30), "net": as_money("260"), "iva": as_money("57.20"), "status": "PAGATA", "paid": as_money("317.20"), "description": "Stampa materiali POP per attivazione retail autunno."},
    {"fic_id": "DEMO-FP-ACT-LMN-202602", "supplier": "activecampaign", "cliente": "LMN", "project": "automation", "issue_date": date(2026, 2, 8), "due_date": date(2026, 2, 23), "net": as_money("95"), "iva": as_money("20.90"), "status": "PAGATA", "paid": as_money("115.90"), "description": "Licenza ActiveCampaign e add-on automazioni febbraio."},
    {"fic_id": "DEMO-FP-ACT-CLB-202604", "supplier": "activecampaign", "cliente": "CLB", "project": "editoriale", "issue_date": date(2026, 4, 8), "due_date": date(2026, 4, 23), "net": as_money("110"), "iva": as_money("24.20"), "status": "ATTESA", "paid": as_money("0"), "description": "Licenza webinar nurture e automazioni enrollment aprile."},
]


PAYMENT_RULES = {
    "PAID": {"paid_ratio": Decimal("1.00"), "status": "PAGATA", "days_to_pay": 18},
    "PARTIAL": {"paid_ratio": Decimal("0.45"), "status": "PARZIALE", "days_to_pay": 12},
    "DUE": {"paid_ratio": Decimal("0.00"), "status": "ATTESA", "days_to_pay": None},
}


PROGRESS_BY_COMMESSA_STATUS = {
    CommessaStatus.APERTA: Decimal("0.55"),
    CommessaStatus.PRONTA_CHIUSURA: Decimal("0.82"),
    CommessaStatus.CHIUSA: Decimal("0.92"),
    CommessaStatus.FATTURATA: Decimal("0.97"),
    CommessaStatus.INCASSATA: Decimal("1.00"),
}


def allocate_integers(total: int, weights: list[Decimal]) -> list[int]:
    if total <= 0 or not weights:
        return [0 for _ in weights]

    total_weight = sum(weights)
    if total_weight <= 0:
        return [0 for _ in weights]

    raw_values = [(Decimal(total) * weight / total_weight) for weight in weights]
    integers = [int(value) for value in raw_values]
    remainder = total - sum(integers)

    order = sorted(
        range(len(weights)),
        key=lambda index: (raw_values[index] - integers[index]),
        reverse=True,
    )
    for index in order[:remainder]:
        integers[index] += 1

    return integers


def resolve_task_status(commessa_status: CommessaStatus, blueprint_index: int, month_date: date) -> TaskStatus:
    if commessa_status in (CommessaStatus.CHIUSA, CommessaStatus.FATTURATA, CommessaStatus.INCASSATA):
        return TaskStatus.PUBBLICATO

    if commessa_status == CommessaStatus.PRONTA_CHIUSURA:
        states = [TaskStatus.PRONTO, TaskStatus.PROGRAMMATO, TaskStatus.PROGRAMMATO]
        return states[blueprint_index]

    if month_date == month(DEMO_REFERENCE_TODAY.year, DEMO_REFERENCE_TODAY.month):
        states = [TaskStatus.IN_REVIEW, TaskStatus.PROGRAMMATO, TaskStatus.DA_FARE]
        return states[blueprint_index]

    return TaskStatus.PROGRAMMATO


def resolve_due_date(month_date: date, blueprint_index: int) -> date:
    due_days = [5, 12, 24]
    return with_day(month_date, due_days[blueprint_index])


def resolve_timesheet_dates(month_date: date, blueprint_index: int, parts_count: int) -> list[date]:
    if month_date == month(DEMO_REFERENCE_TODAY.year, DEMO_REFERENCE_TODAY.month):
        base_days = [[2, 6], [3, 7], [4, 8]]
    else:
        base_days = [[3, 5], [9, 14], [18, 24]]
    return [with_day(month_date, day) for day in base_days[blueprint_index][:parts_count]]


async def upsert_coefficients(db):
    for month_date, coefficient in MONTH_COEFFICIENTS.items():
        result = await db.execute(
            select(CoefficienteAllocazione).where(CoefficienteAllocazione.mese_competenza == month_date)
        )
        record = result.scalar_one_or_none()

        stipendi_operativi = as_money("12800")
        overhead_produttivo = (stipendi_operativi / coefficient).quantize(MONEY, rounding=ROUND_HALF_UP)

        if record is None:
            record = CoefficienteAllocazione(
                id=uuid.uuid4(),
                mese_competenza=month_date,
                stipendi_operativi=stipendi_operativi,
                overhead_produttivo=overhead_produttivo,
                note="Seed finance demo Bite Digital",
            )
            db.add(record)

        record.stipendi_operativi = stipendi_operativi
        record.overhead_produttivo = overhead_produttivo
        record.note = "Seed finance demo Bite Digital"


async def get_or_create_user(db, payload):
    result = await db.execute(select(User).where(User.email == payload["email"]))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            id=uuid.uuid4(),
            email=payload["email"],
            password_hash=demo_password_hash(),
            nome=payload["nome"],
            cognome=payload["cognome"],
            ruolo=payload["ruolo"],
            costo_orario=payload["costo_orario"],
            ore_settimanali=payload["ore_settimanali"],
            attivo=True,
        )
        db.add(user)
        await db.flush()

    user.nome = payload["nome"]
    user.cognome = payload["cognome"]
    user.ruolo = payload["ruolo"]
    user.costo_orario = payload["costo_orario"]
    user.ore_settimanali = payload["ore_settimanali"]
    user.attivo = True
    user.bio = "Risorsa demo generata per analytics, reports e timesheet."
    return user


async def get_or_create_cliente(db, payload):
    result = await db.execute(select(Cliente).where(Cliente.codice_cliente == payload["code"]))
    cliente = result.scalar_one_or_none()

    if cliente is None:
        cliente = Cliente(
            id=uuid.uuid4(),
            codice_cliente=payload["code"],
            ragione_sociale=payload["name"],
            email=payload["email"],
            referente=payload["referente"],
            attivo=True,
        )
        db.add(cliente)
        await db.flush()

    cliente.ragione_sociale = payload["name"]
    cliente.codice_cliente = payload["code"]
    cliente.email = payload["email"]
    cliente.referente = payload["referente"]
    cliente.tipologia = payload["tipologia"]
    cliente.comune = payload["comune"]
    cliente.provincia = payload["provincia"]
    cliente.paese = "Italia"
    cliente.condizioni_pagamento = payload["payment_terms"]
    cliente.note = payload["note"]
    cliente.affidabilita = payload["affidabilita"]
    cliente.fic_cliente_id = f"DEMO-CLIENT-{payload['code']}"
    cliente.attivo = True
    return cliente


async def get_or_create_progetto(db, cliente, payload):
    result = await db.execute(
        select(Progetto).where(Progetto.cliente_id == cliente.id, Progetto.nome == payload["name"])
    )
    progetto = result.scalar_one_or_none()

    if progetto is None:
        progetto = Progetto(
            id=uuid.uuid4(),
            cliente_id=cliente.id,
            nome=payload["name"],
            tipo=payload["type"],
            stato=ProjectStatus.ATTIVO,
            importo_fisso=payload["fixed"],
            importo_variabile=payload["variable"],
            delivery_attesa=payload["delivery_attesa"],
            note="Seed demo finance/reporting",
        )
        db.add(progetto)
        await db.flush()

    progetto.tipo = payload["type"]
    progetto.stato = ProjectStatus.ATTIVO
    progetto.importo_fisso = payload["fixed"]
    progetto.importo_variabile = payload["variable"]
    progetto.delivery_attesa = payload["delivery_attesa"]
    progetto.note = f"Seed demo finance/reporting | kind={payload['kind']}"
    return progetto


async def upsert_commessa(db, cliente, project_map, payload):
    result = await db.execute(
        select(Commessa).where(
            Commessa.cliente_id == cliente.id,
            Commessa.mese_competenza == payload["month"],
        )
    )
    commessa = result.scalar_one_or_none()

    if commessa is None:
        commessa = Commessa(
            id=uuid.uuid4(),
            cliente_id=cliente.id,
            mese_competenza=payload["month"],
        )
        db.add(commessa)
        await db.flush()

    commessa.stato = payload["status"]
    commessa.costi_diretti = payload["direct"]
    commessa.ore_contratto = payload["hours"]
    commessa.note = payload["note"]
    commessa.data_inizio = payload["month"]
    commessa.data_fine = with_day(payload["month"], 28)
    commessa.data_chiusura = with_day(payload["month"], 28) if payload["status"] in (CommessaStatus.CHIUSA, CommessaStatus.FATTURATA, CommessaStatus.INCASSATA) else None
    commessa.fattura_id = None

    for row_payload in payload["rows"]:
        project_seed = project_map[row_payload["project"]]
        progetto = project_seed["instance"]

        row_result = await db.execute(
            select(CommessaProgetto).where(
                CommessaProgetto.commessa_id == commessa.id,
                CommessaProgetto.progetto_id == progetto.id,
            )
        )
        row = row_result.scalar_one_or_none()

        if row is None:
            row = CommessaProgetto(
                id=uuid.uuid4(),
                commessa_id=commessa.id,
                progetto_id=progetto.id,
            )
            db.add(row)

        row.importo_fisso = project_seed["fixed"]
        row.importo_variabile = project_seed["variable"]
        row.delivery_attesa = project_seed["delivery_attesa"]
        row.delivery_consuntiva = row_payload["delivery_consuntiva"]

    await db.flush()
    return commessa


async def get_or_create_task(db, *, clickup_task_id: str, defaults: dict):
    result = await db.execute(select(Task).where(Task.clickup_task_id == clickup_task_id))
    task = result.scalar_one_or_none()

    if task is None:
        task = Task(id=uuid.uuid4(), clickup_task_id=clickup_task_id, **defaults)
        db.add(task)
        await db.flush()
        return task

    for key, value in defaults.items():
        setattr(task, key, value)
    return task


async def get_or_create_timesheet(db, *, note_key: str, defaults: dict):
    result = await db.execute(select(Timesheet).where(Timesheet.note == note_key))
    timesheet = result.scalar_one_or_none()

    if timesheet is None:
        timesheet = Timesheet(id=uuid.uuid4(), note=note_key, **defaults)
        db.add(timesheet)
        await db.flush()
        return timesheet

    for key, value in defaults.items():
        setattr(timesheet, key, value)
    timesheet.note = note_key
    return timesheet


async def seed_tasks_and_timesheets_for_commessa(
    db,
    *,
    cliente_payload: dict,
    project_map: dict,
    commessa_payload: dict,
    commessa: Commessa,
    alias_map: dict,
    approver: User,
):
    first_project_slug = commessa_payload["rows"][0]["project"]
    primary_project = project_map[first_project_slug]
    blueprints = TASK_BLUEPRINTS.get(primary_project["kind"], TASK_BLUEPRINTS["SOCIAL"])

    estimated_total_minutes = int((commessa_payload["hours"] * Decimal("60")).to_integral_value(rounding=ROUND_HALF_UP))
    estimated_minutes_by_task = allocate_integers(
        estimated_total_minutes,
        [item["share"] for item in blueprints],
    )

    progress_multiplier = PROGRESS_BY_COMMESSA_STATUS[commessa_payload["status"]]
    logged_total_minutes = int((Decimal(estimated_total_minutes) * progress_multiplier).to_integral_value(rounding=ROUND_HALF_UP))
    logged_minutes_by_task = allocate_integers(
        logged_total_minutes,
        [item["share"] for item in blueprints],
    )

    total_cost = Decimal("0")

    for index, blueprint in enumerate(blueprints):
        assigned_user = alias_map[blueprint["alias"]]
        task_status = resolve_task_status(commessa_payload["status"], index, commessa_payload["month"])
        task_clickup_id = f"DEMO-TASK-{cliente_payload['code']}-{month_label(commessa_payload['month'])}-{blueprint['slug']}"
        task_title = f"{primary_project['instance'].nome} | {blueprint['title']}"
        due_date = resolve_due_date(commessa_payload["month"], index)

        task = await get_or_create_task(
            db,
            clickup_task_id=task_clickup_id,
            defaults={
                "progetto_id": primary_project["instance"].id,
                "commessa_id": commessa.id,
                "assegnatario_id": assigned_user.id,
                "revisore_id": approver.id,
                "titolo": task_title,
                "descrizione": f"{cliente_payload['name']} | {commessa_payload['note']}",
                "stato": task_status,
                "data_inizio": commessa_payload["month"],
                "data_scadenza": due_date,
                "stima_minuti": estimated_minutes_by_task[index],
            },
        )

        logged_minutes = logged_minutes_by_task[index]
        if logged_minutes <= 0:
            continue

        parts = [logged_minutes] if logged_minutes < 150 else allocate_integers(logged_minutes, [Decimal("0.65"), Decimal("0.35")])
        dates = resolve_timesheet_dates(commessa_payload["month"], index, len(parts))

        for part_index, (minutes, activity_date) in enumerate(zip(parts, dates)):
            stato = TimesheetStatus.APPROVATO
            approved_at = datetime.combine(activity_date, datetime.min.time())
            approvato_da = approver.id
            if (
                commessa_payload["month"] == month(DEMO_REFERENCE_TODAY.year, DEMO_REFERENCE_TODAY.month)
                and commessa_payload["status"] in (CommessaStatus.APERTA, CommessaStatus.PRONTA_CHIUSURA)
                and index == 2
            ):
                stato = TimesheetStatus.PENDING
                approved_at = None
                approvato_da = None

            hourly_cost = assigned_user.costo_orario or Decimal("0")
            work_cost = (hourly_cost * Decimal(minutes) / Decimal("60")).quantize(MONEY, rounding=ROUND_HALF_UP)
            note_key = f"DEMO-TS-{task_clickup_id}-{part_index + 1}"

            await get_or_create_timesheet(
                db,
                note_key=note_key,
                defaults={
                    "user_id": assigned_user.id,
                    "task_id": task.id,
                    "commessa_id": commessa.id,
                    "data_attivita": activity_date,
                    "mese_competenza": commessa_payload["month"],
                    "servizio": blueprint["service"],
                    "durata_minuti": minutes,
                    "costo_orario_snapshot": hourly_cost,
                    "costo_lavoro": work_cost,
                    "stato": stato,
                    "approvato_da": approvato_da,
                    "approvato_at": approved_at,
                    "clickup_task_id": task_clickup_id,
                    "task_display_name": task.titolo,
                },
            )
            total_cost += work_cost

    commessa.costo_manodopera = total_cost.quantize(MONEY, rounding=ROUND_HALF_UP)
    await db.flush()


def calculate_commessa_invoice_amount(project_map: dict, commessa_payload: dict) -> Decimal:
    totale = Decimal("0")
    for row_payload in commessa_payload["rows"]:
        project_seed = project_map[row_payload["project"]]
        importo_fisso = project_seed["fixed"]
        importo_variabile = project_seed["variable"]
        delivery_attesa = project_seed["delivery_attesa"]
        delivery_consuntiva = row_payload["delivery_consuntiva"]

        if delivery_attesa and delivery_attesa > 0:
            totale += importo_fisso + (importo_variabile / delivery_attesa) * delivery_consuntiva
        else:
            totale += importo_fisso

    return as_money(totale)


async def upsert_active_invoice(
    db,
    *,
    cliente_payload: dict,
    cliente: Cliente,
    project_map: dict,
    commessa_payload: dict,
    commessa: Commessa,
):
    billing_mode = commessa_payload["billing"]
    if billing_mode == "NONE":
        commessa.fattura_id = None
        return None

    rules = PAYMENT_RULES[billing_mode]
    invoice_fic_id = f"DEMO-FA-{cliente_payload['code']}-{month_label(commessa_payload['month'])}"
    result = await db.execute(select(FatturaAttiva).where(FatturaAttiva.fic_id == invoice_fic_id))
    invoice = result.scalar_one_or_none()

    if invoice is None:
        invoice = FatturaAttiva(
            id=uuid.uuid4(),
            fic_id=invoice_fic_id,
            cliente_id=cliente.id,
        )
        db.add(invoice)
        await db.flush()

    importo_netto = calculate_commessa_invoice_amount(project_map, commessa_payload)
    importo_iva = as_money(importo_netto * Decimal("0.22"))
    importo_totale = as_money(importo_netto + importo_iva)
    importo_pagato = as_money(importo_totale * rules["paid_ratio"])
    importo_residuo = as_money(importo_totale - importo_pagato)
    emissione = with_day(commessa_payload["month"], 28 if commessa_payload["month"] < month(2026, 4) else 7)
    scadenza = emissione + timedelta(days=30)
    ultimo_incasso = None
    if rules["days_to_pay"] is not None and importo_pagato > 0:
        ultimo_incasso = emissione + timedelta(days=rules["days_to_pay"])

    invoice.cliente_id = cliente.id
    invoice.fic_cliente_id = cliente.fic_cliente_id
    invoice.numero = f"BD-{commessa_payload['month'].strftime('%Y%m')}-{cliente_payload['code']}"
    invoice.data_emissione = emissione
    invoice.data_scadenza = scadenza
    invoice.importo_netto = importo_netto
    invoice.importo_iva = importo_iva
    invoice.importo_totale = importo_totale
    invoice.importo_pagato = importo_pagato
    invoice.importo_residuo = importo_residuo
    invoice.stato_pagamento = rules["status"]
    invoice.data_ultimo_incasso = ultimo_incasso
    invoice.valuta = "EUR"
    invoice.payments_raw = {"seed": "bite-demo", "paid_ratio": str(rules["paid_ratio"]), "mode": billing_mode}
    invoice.fic_raw_data = {"origine": "seed_boss_data.py", "commessa_id": str(commessa.id), "cliente_code": cliente_payload["code"]}

    commessa.fattura_id = invoice.id
    await db.flush()
    return invoice


async def get_or_create_supplier_category(db, payload):
    result = await db.execute(select(CategoriaFornitore).where(CategoriaFornitore.nome == payload["name"]))
    category = result.scalar_one_or_none()

    if category is None:
        category = CategoriaFornitore(
            id=uuid.uuid4(),
            nome=payload["name"],
            colore=payload["color"],
        )
        db.add(category)
        await db.flush()

    category.colore = payload["color"]
    return category


async def get_or_create_supplier(db, payload, category_map):
    result = await db.execute(select(Fornitore).where(Fornitore.ragione_sociale == payload["name"]))
    supplier = result.scalar_one_or_none()

    if supplier is None:
        supplier = Fornitore(
            id=uuid.uuid4(),
            ragione_sociale=payload["name"],
            fic_id=f"DEMO-SUP-{payload['slug'].upper()}",
        )
        db.add(supplier)
        await db.flush()

    supplier.fic_id = f"DEMO-SUP-{payload['slug'].upper()}"
    supplier.email = payload["email"]
    supplier.telefono = payload["telefono"]
    supplier.categoria = payload["category"]
    supplier.categoria_id = category_map[payload["category"]].id
    supplier.attivo = True
    supplier.note = "Fornitore demo finance/reporting"
    return supplier


async def upsert_passive_invoice(db, payload, supplier_map, client_map):
    result = await db.execute(select(FatturaPassiva).where(FatturaPassiva.fic_id == payload["fic_id"]))
    invoice = result.scalar_one_or_none()

    if invoice is None:
        invoice = FatturaPassiva(
            id=uuid.uuid4(),
            fic_id=payload["fic_id"],
            fornitore_id=supplier_map[payload["supplier"]].id,
        )
        db.add(invoice)
        await db.flush()

    total = as_money(payload["net"] + payload["iva"])
    paid = payload["paid"]
    residual = as_money(total - paid)
    ultimo_pagamento = payload["issue_date"] + timedelta(days=10) if paid > 0 else None

    invoice.fornitore_id = supplier_map[payload["supplier"]].id
    invoice.fic_fornitore_id = supplier_map[payload["supplier"]].fic_id
    invoice.numero = payload["fic_id"].replace("DEMO-FP-", "FP-")
    invoice.data_emissione = payload["issue_date"]
    invoice.data_scadenza = payload["due_date"]
    invoice.importo_netto = payload["net"]
    invoice.importo_iva = payload["iva"]
    invoice.importo_totale = total
    invoice.importo_pagato = paid
    invoice.importo_residuo = residual
    invoice.stato_pagamento = payload["status"]
    invoice.data_ultimo_pagamento = ultimo_pagamento
    invoice.valuta = "EUR"
    invoice.categoria = supplier_map[payload["supplier"]].categoria
    invoice.payments_raw = {"seed": "bite-demo", "description": payload["description"]}
    invoice.fic_raw_data = {"origine": "seed_boss_data.py", "cliente_code": payload.get("cliente"), "project_slug": payload.get("project")}

    await db.flush()

    if payload.get("cliente") and payload.get("project"):
        cliente = client_map[payload["cliente"]]["instance"]
        progetto = client_map[payload["cliente"]]["projects"][payload["project"]]["instance"]
        allocation_query = await db.execute(
            select(FatturaPassivaImputazione).where(
                FatturaPassivaImputazione.fattura_passiva_id == invoice.id,
                FatturaPassivaImputazione.cliente_id == cliente.id,
                FatturaPassivaImputazione.progetto_id == progetto.id,
            )
        )
        allocation = allocation_query.scalar_one_or_none()
        if allocation is None:
            allocation = FatturaPassivaImputazione(
                id=uuid.uuid4(),
                fattura_passiva_id=invoice.id,
                cliente_id=cliente.id,
                progetto_id=progetto.id,
            )
            db.add(allocation)
        allocation.tipo = "PROGETTO"
        allocation.percentuale = Decimal("100.00")
        allocation.importo = payload["net"]
        allocation.note = payload["description"]

    return invoice


async def upsert_fixed_cost(db, payload):
    result = await db.execute(select(CostoFisso).where(CostoFisso.descrizione == payload["descrizione"]))
    cost = result.scalar_one_or_none()

    if cost is None:
        cost = CostoFisso(
            id=uuid.uuid4(),
            descrizione=payload["descrizione"],
            importo=payload["importo"],
        )
        db.add(cost)
        await db.flush()

    cost.importo = payload["importo"]
    cost.categoria = payload["categoria"]
    cost.periodicita = payload["periodicita"]
    cost.attivo = True
    cost.data_inizio = payload["data_inizio"]
    cost.data_fine = payload.get("data_fine")
    cost.note = payload["note"]
    return cost


async def upsert_cash_movement(
    db,
    *,
    key: str,
    data_valuta: date,
    descrizione: str,
    categoria: str,
    importo: Decimal,
    tipo: str,
    fattura_attiva_id=None,
    fattura_passiva_id=None,
    riconciliato: bool,
):
    result = await db.execute(select(MovimentoCassa).where(MovimentoCassa.descrizione == key))
    movement = result.scalar_one_or_none()

    if movement is None:
        movement = MovimentoCassa(
            id=uuid.uuid4(),
            descrizione=key,
            data_valuta=data_valuta,
            importo=importo,
        )
        db.add(movement)
        await db.flush()

    movement.data_valuta = data_valuta
    movement.data_contabile = data_valuta
    movement.descrizione = key
    movement.categoria = categoria
    movement.importo = importo
    movement.tipo = tipo
    movement.fattura_attiva_id = fattura_attiva_id
    movement.fattura_passiva_id = fattura_passiva_id
    movement.riconciliato = riconciliato
    movement.note = descrizione
    return movement


async def seed_dashboard_demo_data():
    async with AsyncSessionLocal() as db:
        await upsert_coefficients(db)

        alias_map = {}
        total_team = 0
        for user_payload in DEMO_TEAM:
            user = await get_or_create_user(db, user_payload)
            total_team += 1
            for alias in user_payload["aliases"]:
                alias_map[alias] = user

        approver = alias_map["approver"]

        total_clienti = 0
        total_progetti = 0
        total_commesse = 0
        total_fatture_attive = 0
        total_fatture_passive = 0
        total_costi_fissi = 0
        total_movimenti = 0
        client_map: dict[str, dict] = {}

        for client_payload in DEMO_CLIENTS:
            cliente = await get_or_create_cliente(db, client_payload)
            total_clienti += 1

            project_map = {}
            for project_payload in client_payload["projects"]:
                progetto = await get_or_create_progetto(db, cliente, project_payload)
                total_progetti += 1
                project_map[project_payload["slug"]] = {
                    "instance": progetto,
                    "fixed": project_payload["fixed"],
                    "variable": project_payload["variable"],
                    "delivery_attesa": project_payload["delivery_attesa"],
                    "kind": project_payload["kind"],
                }

            client_map[client_payload["code"]] = {"instance": cliente, "projects": project_map}

            for commessa_payload in client_payload["commesse"]:
                commessa = await upsert_commessa(db, cliente, project_map, commessa_payload)
                total_commesse += 1
                await seed_tasks_and_timesheets_for_commessa(
                    db,
                    cliente_payload=client_payload,
                    project_map=project_map,
                    commessa_payload=commessa_payload,
                    commessa=commessa,
                    alias_map=alias_map,
                    approver=approver,
                )
                active_invoice = await upsert_active_invoice(
                    db,
                    cliente_payload=client_payload,
                    cliente=cliente,
                    project_map=project_map,
                    commessa_payload=commessa_payload,
                    commessa=commessa,
                )
                if active_invoice is not None:
                    total_fatture_attive += 1
                    if active_invoice.importo_pagato and active_invoice.importo_pagato > 0:
                        await upsert_cash_movement(
                            db,
                            key=f"DEMO-MOV-IN-{active_invoice.fic_id}",
                            data_valuta=active_invoice.data_ultimo_incasso or active_invoice.data_emissione,
                            descrizione=f"Incasso fattura {active_invoice.numero} - {cliente.ragione_sociale}",
                            categoria="INCASSI CLIENTI",
                            importo=active_invoice.importo_pagato,
                            tipo="ENTRATA",
                            fattura_attiva_id=active_invoice.id,
                            riconciliato=True,
                        )
                        total_movimenti += 1

        category_map = {}
        for category_payload in DEMO_SUPPLIER_CATEGORIES:
            category = await get_or_create_supplier_category(db, category_payload)
            category_map[category_payload["name"]] = category

        supplier_map = {}
        for supplier_payload in DEMO_SUPPLIERS:
            supplier = await get_or_create_supplier(db, supplier_payload, category_map)
            supplier_map[supplier_payload["slug"]] = supplier

        for payload in DEMO_FIXED_COSTS:
            await upsert_fixed_cost(db, payload)
            total_costi_fissi += 1

        for payload in DEMO_PASSIVE_INVOICES:
            passive_invoice = await upsert_passive_invoice(db, payload, supplier_map, client_map)
            total_fatture_passive += 1
            if passive_invoice.importo_pagato and passive_invoice.importo_pagato > 0:
                await upsert_cash_movement(
                    db,
                    key=f"DEMO-MOV-OUT-{passive_invoice.fic_id}",
                    data_valuta=passive_invoice.data_ultimo_pagamento or passive_invoice.data_emissione,
                    descrizione=f"Pagamento fattura passiva {passive_invoice.numero} - {passive_invoice.fornitore_nome or 'Fornitore'}",
                    categoria=passive_invoice.categoria or "FORNITORI",
                    importo=as_money(passive_invoice.importo_pagato * Decimal("-1")),
                    tipo="USCITA",
                    fattura_passiva_id=passive_invoice.id,
                    riconciliato=True,
                )
                total_movimenti += 1

        result_tasks = await db.execute(select(Task).where(Task.clickup_task_id.like("DEMO-TASK-%")))
        total_tasks = len(result_tasks.scalars().all())
        result_timesheets = await db.execute(select(Timesheet).where(Timesheet.note.like("DEMO-TS-%")))
        total_timesheets = len(result_timesheets.scalars().all())

        await db.commit()

        print(
            "Seed finance completato: "
            f"{total_team} utenti demo, {total_clienti} clienti, {total_progetti} progetti, {total_commesse} commesse, "
            f"{total_fatture_attive} fatture attive, {total_fatture_passive} fatture passive, "
            f"{total_costi_fissi} costi fissi, {total_tasks} task, {total_timesheets} timesheet, "
            f"{total_movimenti} movimenti di cassa."
        )
        print("Copertura temporale: novembre 2025 -> aprile 2026.")


if __name__ == "__main__":
    try:
        asyncio.run(seed_dashboard_demo_data())
    except Exception as exc:
        print(f"Impossibile completare il seed finance demo: {exc}", file=sys.stderr)
        raise
