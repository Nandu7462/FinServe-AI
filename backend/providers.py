import json
import os
from pathlib import Path

import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from pydantic import BaseModel, ConfigDict, Field


class DraftText(BaseModel):
    model_config = ConfigDict(extra="forbid")
    subject: str = Field(min_length=1, max_length=160)
    introduction: str = Field(min_length=1, max_length=1000)
    explanation: str = Field(default="", max_length=2000)
    closing: str = Field(min_length=1, max_length=1000)
    sms_text: str = Field(default="", max_length=320)


async def fetch_source(url):
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        raise ValueError("FIRECRAWL_API_KEY is not set.")
    async with httpx.AsyncClient(timeout=50) as client:
        response = await client.post(
            "https://api.firecrawl.dev/v2/scrape",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"url": url, "formats": ["markdown"], "onlyMainContent": True, "maxAge": 0},
        )
        response.raise_for_status()
    data = response.json()["data"]
    if data.get("metadata", {}).get("sourceURL", "").rstrip("/") != url.rstrip("/"):
        raise ValueError("The source redirected. Configure the final official URL.")
    markdown = data.get("markdown", "")
    if not markdown.strip():
        raise ValueError("The official source returned no text.")
    return markdown


def generate_template_draft(product, tone, wording, category="Fee change", statement="", bank="Harborline Bank", language="English"):
    cat_lower = (category or "").lower()
    lang_lower = (language or "English").lower()

    # Multilingual templates
    if lang_lower == "hindi":
        if "fee" in cat_lower:
            subjects = {
                "Friendly": f"आपके {product} वार्षिक शुल्क के संबंध में महत्वपूर्ण अपडेट",
                "Formal": f"{product} शुल्क अनुसूची में संशोधन की आधिकारिक सूचना",
                "Concise": f"अद्यतन: {product} वार्षिक शुल्क सूचना",
            }
            intros = {
                "Friendly": f"हम आशा करते हैं कि आप अपनी {product} सेवाओं से संतुष्ट हैं। हम आपको आपके खाते के शुल्क अनुसूची में आगामी संशोधन की अग्रिम सूचना दे रहे हैं।",
                "Formal": f"यह आधिकारिक अधिसूचना आपको आपके {product} पर लागू शुल्क संरचना में निर्धारित संशोधन के बारे में सूचित करने के लिए है।",
                "Concise": f"कृपया अपने {product} के लिए नीचे उल्लिखित निर्धारित शुल्क संशोधन की समीक्षा करें।",
            }
            explanations = {
                "Friendly": "यह अपडेट 24/7 वास्तविक समय धोखाधड़ी निगरानी, संपर्क रहित भुगतान और आपके लेनदेन की सुरक्षा में निरंतर निवेश का समर्थन करता है।",
                "Formal": "यह शुल्क समायोजन हमारे बैंकिंग ढांचे में निरंतर परिचालन संवर्द्धन, नियामक अनुपालन और मजबूत सुरक्षा प्रोटोकॉल को दर्शाता है।",
                "Concise": "समायोजित शुल्क कार्ड सुरक्षा प्रणाली, संपर्क रहित चिप सुरक्षा और खाता रखरखाव का समर्थन करता है।",
            }
        elif "service" in cat_lower:
            subjects = {
                "Friendly": f"सूचना: {product} के लिए निर्धारित रखरखाव",
                "Formal": f"निर्धारित रखरखाव की अधिसूचना: {product}",
                "Concise": f"सेवा परामर्श: {product} रखरखाव विंडो",
            }
            intros = {
                "Friendly": f"बैंकिंग को सुचारू और सुरक्षित रखने के लिए, हम {product} पर नियमित रखरखाव करेंगे।",
                "Formal": f"कृपया ध्यान दें कि {product} प्लेटफॉर्म पर निर्धारित सिस्टम रखरखाव किया जाएगा।",
                "Concise": f"{product} को प्रभावित करने वाले निर्धारित रखरखाव की सूचना।",
            }
            explanations = {
                "Friendly": "हमारे एटीएम और आपातकालीन कार्ड ब्लॉक सेवाएं इस दौरान पूरी तरह चालू रहेंगी।",
                "Formal": "इस अवधि के दौरान आवश्यक बुनियादी ढांचा अपडेट लागू किया जाएगा। एटीएम और आपातकालीन सेवाएं चालू रहेंगी।",
                "Concise": "सुरक्षा और सर्वर संवर्द्धन लागू किए जा रहे हैं। एटीएम सेवाएं सक्रिय रहेंगी।",
            }
        else:
            subjects = {
                "Friendly": f"आपके {product} के बारे में जानकारी",
                "Formal": f"आधिकारिक उत्पाद सूचना: {product}",
                "Concise": f"सूचना पत्र: {product}",
            }
            intros = {
                "Friendly": f"हम आपके {product} के संबंध में आवश्यक विवरण साझा करते हुए प्रसन्न हैं।",
                "Formal": f"हम आपको आपके {product} के नियम और शर्तों की जानकारी प्रदान कर रहे हैं।",
                "Concise": f"कृपया नीचे अपने {product} का उत्पाद विवरण देखें।",
            }
            explanations = {
                "Friendly": "आपके खाते में डिजिटल स्टेटमेंट, त्वरित मोबाइल अलर्ट और सुरक्षित ऑनलाइन ट्रांसफर शामिल हैं।",
                "Formal": "खाताधारकों को ऑनलाइन खाता प्रबंधन और मासिक इलेक्ट्रॉनिक विवरण की सुविधा मिलती है।",
                "Concise": "सुविधाओं में ऑनलाइन बैंकिंग और डिजिटल सेल्फ-सर्विस टूल शामिल हैं।",
            }
        closing = wording or "यदि आपके कोई प्रश्न हैं या सहायता की आवश्यकता है, तो हमारी ग्राहक सहायता टीम 24/7 उपलब्ध है।"
        sms_statement = statement or f"{product} वार्षिक शुल्क संशोधित होगा।"
        return DraftText(
            subject=subjects.get(tone, subjects["Formal"]),
            introduction=intros.get(tone, intros["Formal"]),
            explanation=explanations.get(tone, explanations["Formal"]),
            closing=closing,
            sms_text=f"{bank} अलर्ट: {sms_statement} {wording or 'प्रश्नों के लिए ग्राहक सेवा पर संपर्क करें।'}"[:320]
        )

    if lang_lower == "spanish":
        if "fee" in cat_lower:
            subjects = {
                "Friendly": f"Actualización importante sobre la tarifa anual de su {product}",
                "Formal": f"Aviso de Revisión del Cuadro de Tarifas de {product}",
                "Concise": f"Actualización: Aviso de Tarifa Anual de {product}",
            }
            intros = {
                "Friendly": f"Esperamos que disfrute de los beneficios de su {product}. Le notificamos sobre una próxima revisión en las tarifas de su cuenta.",
                "Formal": f"Esta notificación oficial tiene como objetivo informarle sobre una revisión programada de la tarifa aplicable a su {product}.",
                "Concise": f"Consulte la revisión programada de tarifas que se detalla a continuación para su {product}.",
            }
            explanations = {
                "Friendly": "Esta actualización respalda inversiones continuas en monitoreo de fraudes 24/7, tecnología sin contacto y protección mundial.",
                "Formal": "Este ajuste de tarifa refleja mejoras operativas continuas, estándares de cumplimiento y protocolos reforzados de seguridad.",
                "Concise": "La tarifa ajustada respalda los sistemas de seguridad, chip sin contacto y mantenimiento de cuenta.",
            }
        elif "service" in cat_lower:
            subjects = {
                "Friendly": f"Aviso: Mantenimiento programado de {product}",
                "Formal": f"Notificación de Mantenimiento Programado: {product}",
                "Concise": f"Aviso de Servicio: Ventana de Mantenimiento de {product}",
            }
            intros = {
                "Friendly": f"Para garantizar un servicio seguro, realizaremos mantenimiento de rutina en {product}.",
                "Formal": f"Se informa que se llevará a cabo mantenimiento programado del sistema en {product}.",
                "Concise": f"Aviso de mantenimiento programado que afecta a {product}.",
            }
            explanations = {
                "Friendly": "Nuestros cajeros automáticos (ATM) y servicios de bloqueo de tarjetas de emergencia permanecerán activos.",
                "Formal": "Durante este período se implementarán actualizaciones esenciales. Los cajeros y servicios urgentes siguen operativos.",
                "Concise": "Se aplican mejoras críticas de infraestructura. Los cajeros automáticos permanecen accesibles.",
            }
        else:
            subjects = {
                "Friendly": f"Información sobre su {product}",
                "Formal": f"Información Oficial de Producto: {product}",
                "Concise": f"Aviso Informativo: {product}",
            }
            intros = {
                "Friendly": f"Nos complace compartir detalles esenciales y características de su {product}.",
                "Formal": f"Le proporcionamos los términos, condiciones y parámetros operativos para su {product}.",
                "Concise": f"Consulte la especificación del producto a continuación para su {product}.",
            }
            explanations = {
                "Friendly": "Su cuenta incluye acceso completo a extractos digitales, alertas móviles instantáneas y transferencias seguras.",
                "Formal": "Los titulares de cuentas se benefician de administración electrónica, estados de cuenta mensuales y protecciones bancarias.",
                "Concise": "Las características incluyen banca en línea, extractos electrónicos y herramientas de autoservicio digital.",
            }
        closing = wording or "Si tiene preguntas o necesita asistencia, nuestro equipo de soporte está disponible las 24 horas."
        sms_statement = statement or f"La tarifa de {product} será modificada."
        return DraftText(
            subject=subjects.get(tone, subjects["Formal"]),
            introduction=intros.get(tone, intros["Formal"]),
            explanation=explanations.get(tone, explanations["Formal"]),
            closing=closing,
            sms_text=f"Alerta {bank}: {sms_statement} {wording or 'Para consultas llame a atención al cliente.'}"[:320]
        )

    if lang_lower == "french":
        if "fee" in cat_lower:
            subjects = {
                "Friendly": f"Mise à jour importante concernant la cotisation annuelle de votre {product}",
                "Formal": f"Avis de Révision de la Grille Tarifaire de {product}",
                "Concise": f"Mise à jour : Avis de Cotisation Annuelle de {product}",
            }
            intros = {
                "Friendly": f"Nous espérons que vous appréciez votre {product}. Nous vous informons d'une révision programmée de votre barème tarifaire.",
                "Formal": f"Cette notification officielle a pour objet de vous informer d'une révision programmée de la tarification de votre {product}.",
                "Concise": f"Veuillez prendre note de la révision tarifaire programmée ci-dessous pour votre {product}.",
            }
            explanations = {
                "Friendly": "Cette mise à jour soutient nos investissements dans la surveillance des fraudes 24h/24, le paiement sans contact et la sécurité.",
                "Formal": "Cet ajustement tarifaire reflète des améliorations opérationnelles continues et le renforcement des protocoles de sécurité.",
                "Concise": "La cotisation ajustée finance la sécurité carte, la protection sans contact et la tenue de compte.",
            }
        else:
            subjects = {
                "Friendly": f"Information importante concernant votre {product}",
                "Formal": f"Notification Officielle : {product}",
                "Concise": f"Avis Informatif : {product}",
            }
            intros = {
                "Friendly": f"Nous sommes ravis de partager avec vous les détails de votre {product}.",
                "Formal": f"Nous vous transmettons les modalités et caractéristiques de fonctionnement de votre {product}.",
                "Concise": f"Veuillez consulter ci-dessous les informations relatives à votre {product}.",
            }
            explanations = {
                "Friendly": "Votre compte comprend l'accès aux relevés électroniques et aux alertes mobiles instantanées.",
                "Formal": "Les titulaires de compte bénéficient de services de banque en ligne et de relevés mensuels sécurisés.",
                "Concise": "Comprend la banque en ligne, les relevés numériques et les outils d'autonomie financière.",
            }
        closing = wording or "Si vous avez des questions, notre équipe d'assistance client est disponible 24h/24."
        sms_statement = statement or f"La cotisation de {product} sera modifiée."
        return DraftText(
            subject=subjects.get(tone, subjects["Formal"]),
            introduction=intros.get(tone, intros["Formal"]),
            explanation=explanations.get(tone, explanations["Formal"]),
            closing=closing,
            sms_text=f"Alerte {bank}: {sms_statement} {wording or 'Pour toute question, contactez notre service client.'}"[:320]
        )

    # Default English templates
    if "fee" in cat_lower:
        subjects = {
            "Friendly": f"Important update regarding your {product} annual fee",
            "Formal": f"Notice of Revision to {product} Fee Schedule",
            "Concise": f"Update: {product} Annual Fee Notice",
        }
        intros = {
            "Friendly": f"We hope you are enjoying the benefits of your {product}. We are writing to give you advance notice regarding an upcoming revision to your account fee schedule.",
            "Formal": f"This official notification is to inform you of a scheduled revision to the fee structure applicable to your {product}.",
            "Concise": f"Please review the scheduled fee revision outlined below for your {product}.",
        }
        explanations = {
            "Friendly": "This update supports ongoing investments in 24/7 real-time fraud monitoring, contactless payment infrastructure, and worldwide security protection for your transactions.",
            "Formal": "This fee adjustment reflects continuous operational enhancements, regulatory compliance standards, and reinforced transaction security protocols across our banking infrastructure.",
            "Concise": "The adjusted fee supports card security systems, contactless chip protection, and account maintenance.",
        }
    elif "service" in cat_lower:
        subjects = {
            "Friendly": f"Heads up: Scheduled maintenance for {product}",
            "Formal": f"Notification of Scheduled Maintenance: {product}",
            "Concise": f"Service Advisory: {product} Maintenance Window",
        }
        intros = {
            "Friendly": f"To keep your banking smooth and secure, we will be performing routine maintenance on our {product}.",
            "Formal": f"Please be advised that scheduled system maintenance will be conducted on the {product} platform.",
            "Concise": f"Notice of scheduled maintenance affecting {product}.",
        }
        explanations = {
            "Friendly": "Our ATMs and emergency card block services will remain fully active during this window. We recommend completing time-sensitive transactions in advance.",
            "Formal": "Essential infrastructure updates will be deployed during this period. Automated teller machines (ATMs) and urgent card services remain operational.",
            "Concise": "Critical security and server enhancements are being applied. ATM services remain accessible throughout.",
        }
    else: # Product
        subjects = {
            "Friendly": f"Exciting information about your {product}",
            "Formal": f"Official Product Information: {product}",
            "Concise": f"Information Notice: {product}",
        }
        intros = {
            "Friendly": f"We are pleased to share essential details and features regarding your {product}.",
            "Formal": f"We are writing to provide you with the terms, conditions, and operational parameters for your {product}.",
            "Concise": f"Please find the product specification for your {product} below.",
        }
        explanations = {
            "Friendly": "Your account includes full access to digital account statements, instant mobile banking alerts, and secure online transfers.",
            "Formal": "Account holders benefit from comprehensive online account administration, monthly electronic statements, and standard depository protections.",
            "Concise": "Features include online banking, electronic monthly statements, and digital self-service tools.",
        }

    closing = wording or f"If you have any questions or require assistance, our customer support team is available 24/7."
    sms_statement = statement or f"Annual fee for {product} will be revised."
    
    return DraftText(
        subject=subjects.get(tone, subjects["Formal"]),
        introduction=intros.get(tone, intros["Formal"]),
        explanation=explanations.get(tone, explanations["Formal"]),
        closing=closing,
        sms_text=f"{bank} Alert: {sms_statement} {wording or 'For queries, call customer support.'}"[:320]
    )


async def draft_text(product, tone, wording, category="Fee change", statement="", context_text="", channel="Email", language="English", bank="Harborline Bank"):
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return generate_template_draft(product, tone, wording, category, statement, bank, language=language)
    
    model = os.getenv("GEMINI_MODEL") or "gemini-3.8-flash"
    prompt = {
        "bank": bank,
        "category": category,
        "product": product,
        "tone": tone,
        "channel": channel,
        "customer_language": language or "English",
        "approved_prior_wording": wording,
        "verified_source_statement": statement,
        "context_excerpt": context_text[:1500] if context_text else "",
    }
    
    system_instruction = (
        "You are FinServe AI, an expert banking and financial services (BFSI) customer communication assistant. "
        "Draft consistent, compliant, and transparent customer communications for products, fees, and service changes. "
        "Follow these strict BFSI rules:\n"
        "1. Accuracy: Respect the verified source statement. Never fabricate fee amounts, dates, or terms.\n"
        "2. Prior Approval Consistency: Align your explanation with the approved prior wording provided.\n"
        "3. Tone: Adhere to the selected customer tone (Friendly, Formal, or Concise).\n"
        f"4. Language: The customer's preferred communication language stored in Memento is '{language or 'English'}'. "
        f"Draft ALL components (subject, introduction, explanation, closing, and sms_text) natively and fluently in '{language or 'English'}', "
        f"using standard banking terminology in {language or 'English'}. Never mix languages.\n"
        "5. Structure:\n"
        "   - subject: Clear, professional subject line (under 160 characters).\n"
        "   - introduction: Courteous, contextual opening.\n"
        "   - explanation: Clear rationale or benefit explanation grounded in the notice context and prior approved wording.\n"
        "   - closing: Helpful guidance on support channels.\n"
        "   - sms_text: Concise, compliant SMS version under 160 characters with the verified statement.\n"
    )

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0)) as client:
            response = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": key},
                json={
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "contents": [{"role": "user", "parts": [{"text": json.dumps(prompt, ensure_ascii=False)}]}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "responseJsonSchema": DraftText.model_json_schema(),
                    },
                },
            )
            response.raise_for_status()
        candidate = response.json()["candidates"][0]
        if candidate.get("finishReason") != "STOP":
            raise ValueError("Gemini did not finish the draft.")
        parts = candidate["content"]["parts"]
        text_content = "".join(part.get("text", "") for part in parts if not part.get("thought"))
        return DraftText.model_validate_json(text_content)
    except Exception as err:
        # Fallback to high quality localized template draft
        return generate_template_draft(product, tone, wording, category, statement, bank, language=language)


async def memento(tool, arguments):
    command = os.getenv("MEMENTO_COMMAND", "npx")
    args = list(json.loads(os.getenv("MEMENTO_ARGS", '["-y","@psraghuveer/memento@0.9.2","serve"]')))
    db_path = str(Path(os.getenv("MEMENTO_DB", "finserve-memory.db")).resolve())
    if "--db" not in args:
        if "serve" in args:
            idx = args.index("serve")
            args[idx:idx] = ["--db", db_path]
        else:
            args.extend(["--db", db_path])
    env = dict(os.environ)
    env["MEMENTO_DB"] = db_path
    parameters = StdioServerParameters(
        command=command, args=args,
        env=env,
    )
    async with stdio_client(parameters) as (reader, writer):
        async with ClientSession(reader, writer) as session:
            await session.initialize()
            result = await session.call_tool(tool, arguments)
    if result.isError:
        raise ValueError("Memento rejected the memory request.")
    if result.structuredContent is not None:
        return result.structuredContent
    for block in result.content:
        if block.type == "text":
            try:
                return json.loads(block.text)
            except json.JSONDecodeError:
                continue
    raise ValueError("Memento returned an unexpected response.")


def memory_entries(value):
    if isinstance(value, dict):
        content = value.get("content")
        if isinstance(content, str):
            yield content
        for nested in value.values():
            yield from memory_entries(nested)
    elif isinstance(value, list):
        for item in value:
            yield from memory_entries(item)


def build_chat_fallback(query: str, notices: list, memories: list, bank: str = "Harborline Bank") -> dict:
    q = (query or "").lower()
    citations = []

    # Check for security / phishing keywords
    if any(k in q for k in ["pin", "otp", "password", "cvv", "passcode", "secret"]):
        return {
            "reply": (
                f"🛡️ **Security Alert from {bank}**\n\n"
                f"**Harborline Bank and its representatives will NEVER ask you for your ATM PIN, Net Banking password, OTP, or card CVV number.**\n\n"
                f"• Please do not share these confidential credentials with anyone.\n"
                f"• If you suspect any fraudulent activity or received a suspicious link, immediately block your card via the Mobile App or call our 24/7 Emergency Fraud Hotline at **1800-HARBORLINE-SEC**."
            ),
            "citations": [{
                "type": "Bank Security Policy",
                "title": "Anti-Phishing & Credential Protection",
                "reference": f"{bank} Customer Protection Guidelines",
                "details": "Strict prohibition against disclosing OTPs, PINs, and CVVs."
            }],
            "grounded": True,
            "source": "grounded_policy"
        }

    # Check for fee / debit card query
    if any(k in q for k in ["fee", "charge", "platinum", "debit", "annual", "waive", "waiver"]):
        fee_notice = next((n for n in notices if "fee" in (n.get("category") or "").lower() or "debit" in (n.get("product") or "").lower()), None)
        fee_mem = next((m for m in memories if "fee" in (m.get("payload", {}).get("category") or "").lower() or "debit" in (m.get("payload", {}).get("product") or "").lower()), None)

        reply_parts = [f"### 💳 Platinum Debit Card Annual Fee Information\n"]
        if fee_notice:
            eff_date = fee_notice.get("effective_date") or "upcoming schedule"
            fee_val = fee_notice.get("fee") or "₹350"
            reply_parts.append(
                f"• **Scheduled Revision**: From **{eff_date}**, the annual fee for the **{fee_notice.get('product', 'Platinum Debit Card')}** is **{fee_val}** (revised from previous ₹250).\n"
                f"• **Rationale**: This adjustment supports continuous enhancements to 24/7 automated fraud monitoring, EMV contactless chip security, and worldwide emergency card assistance."
            )
            citations.append({
                "type": "Official Notice",
                "title": fee_notice.get("title", "Debit Card Annual Fee Revision"),
                "reference": f"{bank} Verified Notice",
                "details": f"{fee_val} effective {eff_date}"
            })

        if fee_mem:
            wording = fee_mem.get("payload", {}).get("reusable_wording", "")
            if wording:
                reply_parts.append(f"\n• **Fee Waiver Policy**: {wording}")
                citations.append({
                    "type": "Approved Policy (Memento)",
                    "title": "Platinum Debit Card Waiver Criteria",
                    "reference": "Compliance Memory Bank",
                    "details": wording
                })

        reply_parts.append(f"\nIf you have further questions or wish to explore card upgrade options, our support team is available 24/7 at **1800-HARBORLINE**.")
        return {
            "reply": "\n".join(reply_parts),
            "citations": citations,
            "grounded": True,
            "source": "grounded_knowledge"
        }

    # Check for maintenance / downtime / service query
    if any(k in q for k in ["maintenance", "service", "down", "outage", "unavailable", "timing", "schedule", "window"]):
        srv_notice = next((n for n in notices if "service" in (n.get("category") or "").lower() or "maintenance" in (n.get("title") or "").lower()), None)
        srv_mem = next((m for m in memories if "service" in (m.get("payload", {}).get("category") or "").lower()), None)

        reply_parts = [f"### ⚙️ Scheduled System Maintenance Notice\n"]
        if srv_notice:
            reply_parts.append(
                f"• **Maintenance Window**: {srv_notice.get('statement', 'Online banking will be undergoing maintenance during off-peak hours.')}\n"
                f"• **Platform Impacted**: {srv_notice.get('product', 'Online Banking')}"
            )
            citations.append({
                "type": "Official Notice",
                "title": srv_notice.get("title", "Scheduled Online Banking Maintenance"),
                "reference": f"{bank} Operational Advisory",
                "details": srv_notice.get("statement", "")
            })

        if srv_mem:
            explanation = srv_mem.get("payload", {}).get("explanation", "")
            reusable = srv_mem.get("payload", {}).get("reusable_wording", "")
            if reusable:
                reply_parts.append(f"• **Continuity of Services**: {reusable}")
            elif explanation:
                reply_parts.append(f"• **Purpose**: {explanation}")
            citations.append({
                "type": "Approved Policy (Memento)",
                "title": "Service Disruption Handling Policy",
                "reference": "Compliance Memory Bank",
                "details": reusable or explanation
            })

        reply_parts.append("\nWe recommend completing any time-sensitive wire transfers before the maintenance window.")
        return {
            "reply": "\n".join(reply_parts),
            "citations": citations,
            "grounded": True,
            "source": "grounded_knowledge"
        }

    # Check for Savings account / statement queries
    if any(k in q for k in ["saving", "account", "statement", "download", "features", "benefit", "passbook"]):
        prod_notice = next((n for n in notices if "product" in (n.get("category") or "").lower() or "saving" in (n.get("product") or "").lower()), None)
        prod_mem = next((m for m in memories if "product" in (m.get("payload", {}).get("category") or "").lower()), None)

        reply_parts = [f"### 🏦 Everyday Savings Account Overview\n"]
        if prod_notice:
            reply_parts.append(f"• **Core Features**: {prod_notice.get('statement', 'Includes online banking and monthly account statements.')}")
            citations.append({
                "type": "Official Notice",
                "title": prod_notice.get("title", "Savings Account Product Information"),
                "reference": f"{bank} Product Disclosure",
                "details": prod_notice.get("statement", "")
            })

        if prod_mem:
            reusable = prod_mem.get("payload", {}).get("reusable_wording", "")
            explanation = prod_mem.get("payload", {}).get("explanation", "")
            if reusable:
                reply_parts.append(f"• **Digital Account Access**: {reusable}")
            if explanation:
                reply_parts.append(f"• **Sustainable Banking**: {explanation}")
            citations.append({
                "type": "Approved Policy (Memento)",
                "title": "Everyday Savings Account Terms",
                "reference": "Compliance Memory Bank",
                "details": reusable or explanation
            })

        reply_parts.append("\nYou can open an account or manage your preferences directly through the Harborline Mobile App.")
        return {
            "reply": "\n".join(reply_parts),
            "citations": citations,
            "grounded": True,
            "source": "grounded_knowledge"
        }

    # Default greeting or general query
    return {
        "reply": (
            f"Hello! I am **FinServe AI**, the official Customer Support Assistant for **{bank}**.\n\n"
            f"I can provide you with verified, compliant information regarding:\n"
            f"• **Product Fees & Revisions** (e.g., Platinum Debit Card annual fees)\n"
            f"• **Fee Waiver Criteria** (balance maintenance and spend thresholds)\n"
            f"• **Scheduled Maintenance Windows** and uninterrupted ATM/UPI availability\n"
            f"• **Account Features** and digital statement retrieval\n\n"
            f"How may I assist you with your banking today?"
        ),
        "citations": [{
            "type": "Support Directory",
            "title": f"{bank} Customer Communication Portal",
            "reference": "FinServe AI BFSI Assistant",
            "details": "Grounding in Firecrawl official notices & Memento compliance memories."
        }],
        "grounded": True,
        "source": "default_guidance"
    }


async def customer_support_chat(
    messages: list[dict],
    context_notices: list[dict],
    context_memories: list[dict],
    bank: str = "Harborline Bank"
) -> dict:
    # 1. Identify latest user query
    user_query = ""
    for msg in reversed(messages):
        if msg.get("role") == "user":
            user_query = msg.get("content", "").strip()
            break

    # Build fallback base
    fallback_res = build_chat_fallback(user_query, context_notices, context_memories, bank)

    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return fallback_res

    # Prepare context summaries for Gemini system prompt
    notices_summary = []
    for n in context_notices[:8]:
        notices_summary.append(
            f"- Title: {n.get('title')}\n"
            f"  Product: {n.get('product')}\n"
            f"  Category: {n.get('category')}\n"
            f"  Fee: {n.get('fee', 'N/A')}\n"
            f"  Effective Date: {n.get('effective_date', 'N/A')}\n"
            f"  Statement: {n.get('statement')}\n"
            f"  Evidence: {n.get('evidence', '')[:200]}"
        )
    notices_text = "\n\n".join(notices_summary) if notices_summary else "No notices available."

    memories_summary = []
    for m in context_memories[:12]:
        p = m.get("payload", {})
        memories_summary.append(
            f"- Product: {p.get('product')}\n"
            f"  Category: {p.get('category')}\n"
            f"  Approved Explanation: {p.get('explanation')}\n"
            f"  Approved Reusable Wording: {p.get('reusable_wording')}"
        )
    memories_text = "\n\n".join(memories_summary) if memories_summary else "No memories available."

    system_instruction = (
        f"You are FinServe AI, the official Customer Support AI Assistant for {bank} (BFSI).\n"
        f"Your goal is to answer retail and commercial customer inquiries with accuracy, empathy, and strict adherence to bank compliance rules.\n\n"
        f"STRICT COMPLIANCE RULES:\n"
        f"1. FACTUAL GROUNDING: Rely strictly on the Official Product Notices and Approved Knowledge Bank (Memento Memories) provided below. Never invent fees, waiver thresholds, dates, or rates.\n"
        f"2. UNKNOWN DETAILS: If the requested information is not in the notices or approved memories, explicitly state that this detail is not available in current notices, and invite the customer to call 24/7 Phone Banking at 1800-HARBORLINE or visit harborlinebank.com.\n"
        f"3. ANTI-PHISHING & SECURITY: Remind customers that {bank} will NEVER ask for passwords, ATM PINs, OTPs, or CVV codes. If the user mentions credentials, warn them immediately.\n"
        f"4. CITATIONS: In your response, mention the source of information when referencing policies or fee changes (e.g. 'Per Harborline Bank's official notice' or 'According to our approved card fee policy').\n"
        f"5. FORMATTING: Use structured, pleasant markdown with bullet points and bold highlights.\n\n"
        f"--- OFFICIAL NOTICES (FIRECRAWL) ---\n{notices_text}\n\n"
        f"--- APPROVED KNOWLEDGE BASE (MEMENTO) ---\n{memories_text}\n"
    )

    # Convert conversation turns to Gemini API format (alternating user/model)
    gemini_contents = []
    for msg in messages:
        role = msg.get("role", "user")
        text = msg.get("content", "").strip()
        if not text:
            continue
        g_role = "model" if role in ("assistant", "model") else "user"
        if gemini_contents and gemini_contents[-1]["role"] == g_role:
            # Merge consecutive turns of same role
            gemini_contents[-1]["parts"][0]["text"] += f"\n\n{text}"
        else:
            gemini_contents.append({"role": g_role, "parts": [{"text": text}]})

    if not gemini_contents:
        return fallback_res

    # Ensure first turn is from user
    if gemini_contents[0]["role"] != "user":
        gemini_contents.insert(0, {"role": "user", "parts": [{"text": "Hello"}]})

    model = os.getenv("GEMINI_MODEL") or "gemini-3.8-flash"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(4.0, connect=2.0)) as client:
            resp = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": key},
                json={
                    "systemInstruction": {"parts": [{"text": system_instruction}]},
                    "contents": gemini_contents,
                    "generationConfig": {
                        "temperature": 0.2,
                        "maxOutputTokens": 800,
                    }
                }
            )
            resp.raise_for_status()
        res_data = resp.json()
        candidates = res_data.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            reply_text = "".join(part.get("text", "") for part in parts if not part.get("thought"))
            if reply_text.strip():
                return {
                    "reply": reply_text.strip(),
                    "citations": fallback_res.get("citations", []),
                    "grounded": True,
                    "source": "gemini"
                }
    except Exception:
        pass

    # If Gemini failed or errored out, seamlessly return grounded fallback
    return fallback_res
