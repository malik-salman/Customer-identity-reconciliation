import express, { Request, Response } from "express";
import { PrismaClient, Contact } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.post("/identify", async (req: Request, res: Response) => {
  try {
    const email: string | undefined = req.body.email;
    const phoneNumber: string | undefined = req.body.phoneNumber;

    if (!email && !phoneNumber) {
      return res.status(400).json({
        error: "Either email or phoneNumber must be provided"
      });
    }

    // STEP 1: Find matching contacts
    const matchedContacts: Contact[] = await prisma.contact.findMany({
      where: {
        OR: [
          ...(email ? [{ email }] : []),
          ...(phoneNumber ? [{ phoneNumber }] : [])
        ]
      }
    });

    // STEP 2: If no matches → create primary
    if (matchedContacts.length === 0) {
      const newContact = await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "primary"
        }
      });

      return res.status(200).json({
        contact: {
          primaryContactId: newContact.id,
          emails: newContact.email ? [newContact.email] : [],
          phoneNumbers: newContact.phoneNumber
            ? [newContact.phoneNumber]
            : [],
          secondaryContactIds: []
        }
      });
    }

    // STEP 3: Collect all primary contacts
    let primaryContacts: Contact[] = [];

    for (const contact of matchedContacts) {
      if (contact.linkPrecedence === "primary") {
        primaryContacts.push(contact);
      } else if (contact.linkedId) {
        const parent = await prisma.contact.findUnique({
          where: { id: contact.linkedId }
        });
        if (parent) primaryContacts.push(parent);
      }
    }

    // Remove duplicate primaries
    primaryContacts = primaryContacts.filter(
      (value, index, self) =>
        index === self.findIndex(p => p.id === value.id)
    );

    // Sort by oldest
    primaryContacts.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    const oldestPrimary = primaryContacts[0];

    // STEP 4: Convert other primaries to secondary
    for (let i = 1; i < primaryContacts.length; i++) {
      await prisma.contact.update({
        where: { id: primaryContacts[i].id },
        data: {
          linkPrecedence: "secondary",
          linkedId: oldestPrimary.id
        }
      });
    }

    // STEP 5: Get all linked contacts
    const allLinkedContacts: Contact[] =
      await prisma.contact.findMany({
        where: {
          OR: [
            { id: oldestPrimary.id },
            { linkedId: oldestPrimary.id }
          ]
        }
      });

    // STEP 6: Check if new info needs secondary
    const emailExists = email
      ? allLinkedContacts.some(c => c.email === email)
      : true;

    const phoneExists = phoneNumber
      ? allLinkedContacts.some(c => c.phoneNumber === phoneNumber)
      : true;

    if (!emailExists || !phoneExists) {
      await prisma.contact.create({
        data: {
          email,
          phoneNumber,
          linkPrecedence: "secondary",
          linkedId: oldestPrimary.id
        }
      });
    }

    // Fetch updated contacts
    const finalContacts: Contact[] =
      await prisma.contact.findMany({
        where: {
          OR: [
            { id: oldestPrimary.id },
            { linkedId: oldestPrimary.id }
          ]
        }
      });

    const emails = [
      oldestPrimary.email,
      ...finalContacts
        .filter(c => c.linkPrecedence === "secondary")
        .map(c => c.email)
    ].filter((e): e is string => Boolean(e));

    const phoneNumbers = [
      oldestPrimary.phoneNumber,
      ...finalContacts
        .filter(c => c.linkPrecedence === "secondary")
        .map(c => c.phoneNumber)
    ].filter((p): p is string => Boolean(p));

    const secondaryContactIds = finalContacts
      .filter(c => c.linkPrecedence === "secondary")
      .map(c => c.id);

    return res.status(200).json({
      contact: {
        primaryContactId: oldestPrimary.id,
        emails: [...new Set(emails)],
        phoneNumbers: [...new Set(phoneNumbers)],
        secondaryContactIds
      }
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
  