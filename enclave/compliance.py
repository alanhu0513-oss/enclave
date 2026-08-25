import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY

def generate_legal_pdf(document_type, user_name, infringing_source, output_filename=None):
    """
    Generates a professional, legally formatted PDF notice locally for free.
    Supported types: 'DMCA' or 'CEASE_AND_DESIST'
    """
    if not output_filename:
        output_filename = f"enclave_{document_type.lower()}_notice.pdf"
        
    # Setup document document frame
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=letter,
        rightMargin=54, leftMargin=54, topMargin=54, bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom professional typography styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        alignment=TA_CENTER,
        spaceAfter=20
    )
    
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['BodyText'],
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        alignment=TA_JUSTIFY,
        spaceAfter=12
    )

    story = []

    if document_type.upper() == "DMCA":
        # Structure formal DMCA digital copyright request
        story.append(Paragraph("<b>DIGITAL MILLENNIUM COPYRIGHT ACT (DMCA) TAKEDOWN NOTICE</b>", title_style))
        story.append(Spacer(1, 15))
        story.append(Paragraph("<b>TO WHOM IT MAY CONCERN / DESIGNATED COPYRIGHT AGENT:</b>", body_style))
        story.append(Spacer(1, 10))
        story.append(Paragraph(
            f"This letter serves as formal notification under Section 512(c) of the Digital Millennium Copyright Act "
            f"that I, <b>{user_name}</b>, am requesting the immediate removal of infringing material hosted on your platform.",
            body_style
        ))
        story.append(Paragraph(
            f"The material in question represents an unauthorized synthesis, clone, or direct reproduction of my personal biometric identity "
            f"and likeness. The infringing material can be reviewed directly at the following location:<br/>"
            f"<u><font color='blue'>{infringing_source}</font></u>",
            body_style
        ))
        story.append(Paragraph(
            "I state under penalty of perjury that the information contained in this notification is accurate, and that I am "
            "the owner, or authorized to act on behalf of the owner, of the exclusive right that is allegedly infringed.",
            body_style
        ))
        story.append(Paragraph(
            "I have a good faith belief that the use of the material in the manner complained of is not authorized by the "
            "copyright owner, its agent, or the law.",
            body_style
        ))
        
    elif document_type.upper() == "CEASE_AND_DESIST":
        # Structure strict Right of Publicity Cease & Desist letter
        story.append(Paragraph("<b>FORMAL CEASE AND DESIST DEMAND</b>", title_style))
        story.append(Spacer(1, 15))
        story.append(Paragraph("<b>CONFIDENTIAL / FOR SETTLEMENT PURPOSES ONLY</b>", body_style))
        story.append(Spacer(1, 10))
        story.append(Paragraph(
            f"This correspondence constitutes a formal legal demand that you immediately cease and desist all unauthorized "
            f"use, manipulation, and reproduction of the digital identity, voice clone, and facial likeness of <b>{user_name}</b>.",
            body_style
        ))
        story.append(Paragraph(
            f"We have identified synthetic media generated using deep learning frameworks that impersonates our client without "
            f"explicit written consent, located at:<br/><u><font color='blue'>{infringing_source}</font></u>",
            body_style
        ))
        story.append(Paragraph(
            "Your actions violate common law rights of publicity, statutory privacy declarations, and constitute unfair "
            "business practices. Failure to immediately remove the content and confirm compliance within forty-eight (48) hours "
            "will force us to advise our client to pursue all available civil remedies, including seeking statutory damages and legal fees.",
            body_style
        ))
        
    else:
        return f"Error: Unsupported legal instrument type '{document_type}'."

    # Footer Signature Element
    story.append(Spacer(1, 30))
    story.append(Paragraph("Respectfully Executed,", body_style))
    story.append(Spacer(1, 15))
    story.append(Paragraph(f"<b>/s/ {user_name}</b>", body_style))
    story.append(Paragraph("Verified Secure via Enclave ID Core Vault", body_style))

    # Compile the components into a PDF binary file
    try:
        doc.build(story)
        return f"Success: Legal notice compiled and saved to '{output_filename}'."
    except Exception as e:
        return f"PDF Compilation Error: {str(e)}"

if __name__ == "__main__":
    # Test document creation if executed standalone
    test_res = generate_legal_pdf("DMCA", "Alice Doe", "https://malicious-website.com")
    print(test_res)

