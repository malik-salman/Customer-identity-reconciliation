# 🧠 Bitespeed Identity Reconciliation Service

## 🚀 Overview

This project implements an Identity Reconciliation backend service for Bitespeed.

The service consolidates customer identities across multiple purchases by linking contact records based on shared email or phone number.

If multiple contacts belong to the same person, they are grouped under one **primary contact**, and others are marked as **secondary**.

---

## 🛠 Tech Stack

- Node.js
- Express.js
- TypeScript
- PostgreSQL
- Prisma ORM

---

## 📌 Problem Statement

Customers may place orders using different emails or phone numbers.

The system must:

- Identify if contacts belong to the same person
- Maintain only one primary contact per identity group
- Convert additional contacts into secondary
- Merge identities when overlapping data appears
- Return consolidated identity response

---

## 🗄 Database Design

### Contact Table

| Field | Description |
|-------|-------------|
| id | Unique identifier |
| email | Customer email (nullable) |
| phoneNumber | Customer phone number (nullable) |
| linkedId | Self-reference to primary contact |
| linkPrecedence | "primary" or "secondary" |
| createdAt | Record creation timestamp |
| updatedAt | Record update timestamp |
| deletedAt | Soft delete field |

### Key Design Concept

- The table is **self-referencing**
- Secondary contacts store `linkedId` pointing to the primary contact
- Only one primary contact exists per identity group

---

## 🔄 API Endpoint

### POST `/identify`

### Request Body

```json
{
  "email": "string (optional)",
  "phoneNumber": "string (optional)"
} 
