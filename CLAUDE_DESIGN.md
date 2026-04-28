# CLAUDE_DESIGN.md — Project Design & Stack Rules

이 프로젝트는 `@minnjii/dx-kit` 디자인 시스템을 사용한다.
모든 UI 구현 시 아래 룰을 반드시 따른다. (운영 프로토콜은 `CLAUDE.md` 참조)

---

## 1. 가장 중요한 룰

**UI 컴포넌트를 절대 새로 만들지 마세요.**
`@minnjii/dx-kit` 패키지에 Button, Input, Card, Dialog, Table, Select, Tabs, Badge, Tooltip 등 전부 있습니다.
페이지/기능 컴포넌트만 새로 만드세요 (`app/`, `components/` 루트의 비즈니스 로직).

### 핵심 원칙
1. 네이티브 HTML 대신 시스템 컴포넌트 사용
2. 하드코딩 색상 금지 — CSS 변수(토큰) 사용
3. `border` 대신 `shadow` 사용
4. 패딩은 넉넉하게 (`p-4` 이상)

---

## 2. 컴포넌트 매핑

| 이것 대신 | 이것을 사용 |
|-----------|------------|
| `<button>` | `<Button>` from `@minnjii/dx-kit/ui/button` |
| `<input>` | `<Input>` from `@minnjii/dx-kit/ui/input` |
| `<textarea>` | `<Textarea>` from `@minnjii/dx-kit/ui/textarea` |
| `<select>` | `<Select>` from `@minnjii/dx-kit/ui/select` |
| `<table>` | `<Table>` from `@minnjii/dx-kit/ui/table` |
| `<dialog>` | `<Dialog>` from `@minnjii/dx-kit/ui/dialog` |
| 커스텀 card | `<Card>` from `@minnjii/dx-kit/ui/card` |
| 커스텀 badge | `<Badge>` from `@minnjii/dx-kit/ui/badge` |
| 커스텀 tooltip | `<Tooltip>` from `@minnjii/dx-kit/ui/tooltip` |
| 커스텀 tabs | `<Tabs>` from `@minnjii/dx-kit/ui/tabs` |
| 커스텀 dropdown | `<DropdownMenu>` from `@minnjii/dx-kit/ui/dropdown-menu` |
| `<hr>` | `<Separator>` from `@minnjii/dx-kit/ui/separator` |
| 커스텀 scroll | `<ScrollArea>` from `@minnjii/dx-kit/ui/scroll-area` |
| 커스텀 toggle | `<Switch>` from `@minnjii/dx-kit/ui/switch` |
| 커스텀 checkbox | `<Checkbox>` from `@minnjii/dx-kit/ui/checkbox` |
| 커스텀 spinner | `<Spinner>` from `@minnjii/dx-kit/ui/spinner` |
| 커스텀 skeleton | `<Skeleton>` from `@minnjii/dx-kit/ui/skeleton` |
| 커스텀 accordion | `<AccordionBlock>` from `@minnjii/dx-kit/ui/accordion-block` |
| 커스텀 task list | `<TaskBlock>` from `@minnjii/dx-kit/ui/task-block` |
| 커스텀 bullet list | `<BulletBlock>` from `@minnjii/dx-kit/ui/bullet-block` |
| 커스텀 content card | `<ContentBlock>` from `@minnjii/dx-kit/ui/content-block` |

### 전체 컴포넌트 풀
`accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, checkbox, collapsible, combobox, command, context-menu, dialog, drawer, dropdown-menu, hover-card, input, input-otp, kbd, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, showcase-card, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip, accordion-block, task-block, bullet-block, content-block, color-picker, status-item, rating`

경로는 항상 `@minnjii/dx-kit/ui/<name>`. `@/components/ui/` 사용 금지.

---

## 3. 디자인 토큰

### 색상 (CSS 변수)
```
bg-background / text-foreground     /* 페이지 */
bg-card / text-card-foreground       /* 카드 */
bg-primary / text-primary-foreground /* 주요 액션 */
bg-secondary / bg-muted              /* 보조·비활성 */
text-muted-foreground                /* 설명 텍스트 */
bg-destructive                       /* 위험·삭제 */
```

```tsx
// BAD
<div className="bg-[#1a1a1a] text-[#fff]">
<div style={{ backgroundColor: '#000' }}>
// GOOD
<div className="bg-card text-card-foreground">
```

### Border Radius
`rounded-lg` (버튼·인풋) · `rounded-xl` (카드) · `rounded-2xl` (큰 카드) · `rounded-full` (아바타·배지)

### Typography
`tracking-[-0.03em]` (큰 제목) · `tracking-tight` (소제목) · `leading-relaxed` (본문) · `text-muted-foreground` (설명)

### 간격
카드 내부 `p-6+`, 섹션 간 `gap-6+`·`py-16+`, 버튼은 시스템 Button의 내장 패딩 사용.

### Border 대신 Shadow
```tsx
// BAD: border border-gray-200
// GOOD: <Card> 또는 shadow-sm shadow-black/5 dark:shadow-black/40
```

---

## 4. 주요 컴포넌트 사용 스니펫

### Button
```tsx
import { Button } from "@minnjii/dx-kit/ui/button"
<Button>Default</Button>
<Button variant="secondary|outline|ghost|destructive|link">...</Button>
<Button size="xs|sm|lg">...</Button>  // default h-11
<Button asChild><Link href="/path">Go</Link></Button>
```

### Card
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@minnjii/dx-kit/ui/card"
<Card>
  <CardHeader>
    <CardTitle>제목</CardTitle>
    <CardDescription>설명</CardDescription>
  </CardHeader>
  <CardContent>본문</CardContent>
</Card>
```

### Dialog
```tsx
<Dialog>
  <DialogTrigger asChild><Button variant="outline">Open</Button></DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>제목</DialogTitle>
      <DialogDescription>설명</DialogDescription>
    </DialogHeader>
    <DialogFooter><Button>확인</Button></DialogFooter>
  </DialogContent>
</Dialog>
```

### Input + Label
```tsx
<div className="grid gap-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="you@example.com" />
</div>
```

### Tabs
```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">내용</TabsContent>
</Tabs>
```

### AccordionBlock (카드형, chevron 좌측, 우측 `action` prop)
```tsx
<AccordionBlock type="single" collapsible>
  <AccordionBlockItem value="1">
    <AccordionBlockTrigger action={<Button size="xs">Edit</Button>}>
      프로젝트 설정
    </AccordionBlockTrigger>
    <AccordionBlockContent>콘텐츠</AccordionBlockContent>
  </AccordionBlockItem>
</AccordionBlock>
```

### TaskBlock (체크 시 취소선·흐림, `badge`로 개수)
```tsx
<TaskBlock category="BX" badge="6" tasks={[
  { id: "1", label: "브랜드 전략", checked: true },
]} />
```

### ShowcaseCard / Rating / ColorPicker
```tsx
<ShowcaseCard imageSrc="/x.jpg" badge="New" category="COMPONENT" title="..." />
<Rating value={rating} onChange={setRating} />
<ColorPicker value={color} onChange={setColor} showInput />
```

---

## 5. 금지 사항

1. 네이티브 `<button>`, `<input>`, `<select>` 직접 사용 금지
2. `border` 대신 `shadow` 사용
3. 하드코딩 색상 (`#fff`, `bg-[#xxx]`) 금지
4. 패딩 `p-1`·`p-2` 지양 — 최소 `p-4`
5. `ring-1 ring-foreground/10` 금지 → `shadow-md shadow-black/5`
6. footer `border-t bg-muted` 분리 패턴 금지
7. 자체 모달·스피너·로더 구현 금지 → 시스템 컴포넌트
8. `@/components/ui/` 경로 금지 → `@minnjii/dx-kit/ui/`

---

## 6. 초기 세팅 & 업데이트

```bash
echo "@minnjii:registry=https://npm.pkg.github.com" > .npmrc
npx @minnjii/dx-kit          # 초기 세팅 (의존성 + globals.css + CLAUDE.md)
npm update @minnjii/dx-kit   # 업데이트
```

`app/globals.css`에 반드시 존재:
```css
@import "@minnjii/dx-kit/styles.css";
```

`app/layout.tsx`에 다크 모드 기본:
```tsx
<html lang="ko" className="dark" suppressHydrationWarning>
```

---

## 7. 기술 스택

Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix Nova) · Geist Font · 다크 모드 기본
