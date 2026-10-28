import type { SketchDay, SketchDetail, SketchRow } from './notice-sketch.types';

export const SKETCH_DAY_LABEL: Record<SketchDay, string> = {
  today: '오늘',
  yesterday: '어제',
  thisWeek: '이번 주',
  earlier: '이전',
};

export const SKETCH_ROWS: SketchRow[] = [
  {
    id: 'toss-talk',
    day: 'today',
    token: { text: '오늘', tone: 'today' },
    title: '토스 채용 설명회',
    when: '오늘 18시',
    qualifier: '경영관 33101호',
    board: '경영대학',
  },
  {
    id: 'exchange',
    day: 'today',
    token: { text: '내일 마감', tone: 'urgent' },
    title: '교환학생 2차 모집',
    when: '내일 17시 마감',
    urgent: true,
    qualifier: '조건 3개',
    board: '국제처',
  },
  {
    id: 'dreamclass',
    day: 'today',
    title: '삼성 드림클래스 멘토',
    when: '11/9(월) 마감',
    qualifier: '월 40만원 활동비',
    board: '소프트웨어학과',
  },
  {
    id: 'interview-talk',
    day: 'today',
    token: { text: '취소', tone: 'cancelled' },
    title: '면접 전략 특강',
    when: '오늘 15시',
    board: '경력개발팀',
    dimmed: true,
  },
  {
    id: 'survey',
    day: 'yesterday',
    token: { text: '마감', tone: 'closed' },
    title: '학생식당 만족도 설문',
    when: '10/26(월) 마감됨',
    dimmed: true,
  },
  {
    id: 'shuttle',
    day: 'yesterday',
    token: { text: '중단', tone: 'stopped' },
    title: '인사캠 셔틀 운행',
    when: '오늘 14~21시 중단',
  },
  {
    id: 'recruit-day',
    day: 'yesterday',
    title: '캠퍼스 리크루팅 데이',
    when: '10/26(월) 10~17시',
    qualifier: '600주년기념관',
    dimmed: true,
  },
  {
    id: 'scholarship',
    day: 'yesterday',
    title: '국가장학금 2차 신청',
    when: '내일 접수 시작 · 11/9(월) 마감',
    qualifier: '미신청 시 지급 불가',
  },
  {
    id: 'thesis',
    day: 'thisWeek',
    token: { text: '연장', tone: 'extended' },
    title: '학위청구논문 제출',
    when: '11/13(금) 마감',
    qualifier: '석사과정만',
  },
  {
    id: 'career-fair',
    day: 'thisWeek',
    token: { text: '연기', tone: 'postponed' },
    title: '진로 박람회',
    when: '11/20(금) 10시',
    qualifier: '삼성학술정보관',
  },
  {
    id: 'grad-photo',
    day: 'thisWeek',
    token: { text: '변경', tone: 'changed' },
    title: '졸업사진 촬영',
    when: '11/3(화) 10시',
    qualifier: '600주년기념관',
  },
  {
    id: 'double-major',
    day: 'thisWeek',
    title: '복수전공 신청',
    when: '11/8(월) 마감',
    dateMark: 'warning',
  },
  {
    id: 'buddy',
    day: 'thisWeek',
    title: 'Global Buddy 모집',
    when: '11/12(목) 발표 예정',
    englishOnly: true,
  },
  {
    id: 'checkup',
    day: 'thisWeek',
    title: '교직원 건강검진',
    when: '11월 중순',
    qualifier: '교직원 대상',
    dimmed: true,
  },
  {
    id: 'library',
    day: 'earlier',
    title: '도서관 이용교육 주간',
    when: '날짜 원문 확인',
    dateMark: 'abstain',
  },
  {
    id: 'report',
    day: 'earlier',
    title: '해외 파견 결과보고서',
    when: '파견 종료 후 3개월 내',
    qualifier: '미제출 시 학점 불인정',
  },
  {
    id: 'reporters',
    day: 'earlier',
    title: '학생 기자단 상시 모집',
    when: '마감일 없음 · 3주 전 게시',
  },
  {
    id: 'seats',
    day: 'earlier',
    title: '열람실 좌석 예약 안내',
    when: '',
  },
];

const DETAILS: SketchDetail[] = [
  {
    id: 'toss-talk',
    originalTitle: '[경력개발팀] 2026 하반기 토스(Toss) 채용 설명회 개최 안내 (10/27 화 18:00, 경영관)',
    board: '경영대학',
    firstSeen: '오늘 처음 올라옴',
    status: { word: '오늘', detail: '18시 시작 · 사전 신청 마감됨', tone: 'open' },
    blocks: [
      {
        label: '언제·어디',
        lines: [
          {
            text: '10/27(화) 18시~19시 30분',
            sub: '경영관 33101호',
            actions: ['map'],
            quote: '일시: 2026. 10. 27.(화) 18:00~19:30',
          },
        ],
      },
      {
        label: '대상',
        lines: [{ text: '관심 있는 재학생 누구나', quote: '관심 있는 재학생 누구나 참여 가능합니다.' }],
      },
      {
        label: '혜택',
        lines: [
          {
            text: '참석자 전원 토스 굿즈',
            fromPoster: true,
            quote: '참석자 전원 굿즈 증정',
          },
          { text: '에어팟 (추첨 5명)', fromPoster: true, quote: '추첨을 통해 5명에게 에어팟 증정' },
        ],
      },
      {
        label: '문의',
        lines: [{ text: '경력개발팀 02-760-0000', actions: ['call'], quote: '문의: 경력개발팀(02-760-0000)' }],
      },
    ],
    original: {
      posters: 2,
      attachments: [],
      links: [{ role: '사전 신청 폼', domain: 'forms.gle' }],
      body: '토스 채용 설명회를 아래와 같이 개최하오니 관심 있는 재학생 누구나 참여 가능합니다.',
    },
  },
  {
    id: 'exchange',
    originalTitle: '[국제처] 2027학년도 1학기 교환학생 2차 모집 공고 (~10/28 17:00)',
    board: '국제처',
    firstSeen: '오늘 처음 올라옴',
    status: { word: '접수 중', detail: '내일 17시 마감', tone: 'soon' },
    blocks: [
      {
        label: '대상',
        lines: [
          { text: '직전 학기까지 2개 학기 이상 이수', quote: '본교에서 2개 학기 이상 이수한 자' },
          { text: '누적 평점 3.0 이상', quote: '누적 평점평균 3.0 이상' },
          { text: '어학 성적 보유 (TOEFL iBT 80 등)', quote: '파견 대학이 요구하는 어학 성적 보유자' },
          { text: '제외: 졸업예정자', sub: '파견 학기에 졸업하는 학생', quote: '파견 학기 졸업예정자는 지원 불가' },
        ],
      },
      {
        label: '신청',
        numbered: true,
        lines: [
          { text: 'GLS에서 온라인 지원서 작성', quote: 'GLS 국제교류 메뉴에서 온라인 지원' },
          {
            text: '지원서·어학성적표를 메일로 제출',
            sub: '제목: [교환학생2차]학번_이름',
            actions: ['email'],
            quote: '메일 제목은 [교환학생2차]학번_이름으로 작성',
          },
        ],
      },
      {
        label: '이후 일정',
        lines: [
          { text: '11/5(목) 면접', quote: '면접: 11월 5일(목)' },
          { text: '11월 넷째 주 결과 발표', quote: '결과 발표: 11월 넷째 주' },
        ],
        footerLink: '원문에서 전체 일정 보기',
      },
      {
        label: '문의',
        lines: [{ text: '국제처 outbound@skku.edu', actions: ['email'], quote: '문의: outbound@skku.edu' }],
      },
    ],
    original: {
      posters: 0,
      attachments: [
        { role: '지원서', name: '교환학생_지원서.hwp' },
        { role: '파견 대학 목록', name: '2027-1_파견대학.xlsx' },
      ],
      links: [{ role: 'GLS 지원 페이지', domain: 'gls.skku.edu' }],
      body: '2027학년도 1학기 교환학생 2차 모집을 아래와 같이 공고합니다.',
    },
    action: { label: '메일로 제출하기', kind: 'email' },
  },
  {
    id: 'dreamclass',
    originalTitle: '[삼성드림클래스] 2026 겨울캠프 대학생 멘토 모집 (~11/9)',
    board: '소프트웨어학과',
    firstSeen: '오늘 처음 올라옴',
    status: { word: '접수 중', detail: '11/9(월) 마감', tone: 'open' },
    blocks: [
      {
        label: '대상',
        lines: [{ text: '대학 재학생', sub: '휴학생 제외', quote: '대학 재학생(휴학생 제외)' }],
      },
      {
        label: '활동 조건',
        lines: [
          { text: '12/28(월)~1/22(금)', quote: '활동 기간: 2026. 12. 28. ~ 2027. 1. 22.' },
          { text: '평일 9시~18시, 합숙', quote: '평일 09:00~18:00, 합숙 진행' },
          { text: '대면 수업, 중학생 대상', sub: '캠프 장소는 선발 후 안내', quote: '중학생 대상 대면 수업' },
        ],
      },
      {
        label: '혜택',
        lines: [{ text: '월 40만원 활동비', quote: '멘토 활동비 월 40만원 지급' }],
      },
      {
        label: '신청',
        numbered: true,
        lines: [{ text: '드림클래스 홈페이지에서 지원서 작성', quote: '드림클래스 홈페이지에서 온라인 지원' }],
      },
    ],
    original: {
      posters: 1,
      attachments: [],
      links: [{ role: '지원 페이지', domain: 'dreamclass.org' }],
      body: '2026 삼성드림클래스 겨울캠프 대학생 멘토를 모집합니다.',
    },
    action: { label: '지원하기', kind: 'link' },
  },
  {
    id: 'thesis',
    originalTitle: '[대학원] 2026학년도 2학기 학위청구논문 제출 기한 연장 안내',
    board: '대학원',
    firstSeen: '이번 주 처음 올라옴',
    change: { what: '마감', before: '11/6(금)', after: '11/13(금)' },
    status: { word: '연장', detail: '11/13(금) 마감', tone: 'open' },
    blocks: [
      {
        label: '대상',
        lines: [{ text: '석사과정 학위청구 대상자', quote: '석사과정 학위청구논문 제출 대상자' }],
      },
      {
        label: '신청',
        numbered: true,
        lines: [{ text: '학과 사무실에 논문 3부 제출', quote: '소속 학과 사무실로 논문 3부 제출' }],
      },
    ],
    original: {
      posters: 0,
      attachments: [{ role: '제출 양식', name: '학위청구논문_제출서.hwp' }],
      links: [],
      body: '학위청구논문 제출 기한을 11월 13일(금)까지 연장합니다.',
    },
  },
  {
    id: 'career-fair',
    originalTitle: '[경력개발팀] 2026 진로 박람회 일정 연기 안내',
    board: '경력개발팀',
    firstSeen: '이번 주 처음 올라옴',
    status: { word: '일정이 바뀌었어요', detail: '11/20(금) 10시', tone: 'neutral' },
    blocks: [
      {
        label: '바뀐 점',
        lines: [
          {
            text: '11/20(금) 10시로 연기',
            sub: '기존 11/13(금) 10시',
            quote: '11월 13일(금)에서 11월 20일(금)로 연기되었습니다.',
          },
        ],
      },
      {
        label: '언제·어디',
        lines: [
          {
            text: '11/20(금) 10시~17시',
            sub: '삼성학술정보관 1층',
            actions: ['map'],
            quote: '일시: 2026. 11. 20.(금) 10:00~17:00',
          },
        ],
      },
    ],
    original: {
      posters: 1,
      attachments: [],
      links: [],
      body: '진로 박람회 일정이 11월 13일(금)에서 11월 20일(금)로 연기되었습니다.',
    },
  },
  {
    id: 'reporters',
    originalTitle: '성대신문 학생 기자 상시 모집',
    board: '성대신문',
    firstSeen: '10/6(화) 처음 올라옴',
    status: { word: '마감일 없음', detail: '3주 전 게시', tone: 'neutral' },
    blocks: [
      {
        label: '신청',
        numbered: true,
        lines: [{ text: '지원서를 메일로 제출', actions: ['email'], quote: '지원서를 메일로 제출해 주세요.' }],
      },
    ],
    original: {
      posters: 0,
      attachments: [{ role: '지원서', name: '기자지원서.hwp' }],
      links: [],
      body: '성대신문에서 학생 기자를 상시 모집합니다.',
    },
    action: { label: '메일로 지원하기', kind: 'email' },
  },
  {
    id: 'interview-talk',
    originalTitle: '[경력개발팀] 면접 전략 특강 취소 안내 (10/27 15:00)',
    board: '경력개발팀',
    firstSeen: '오늘 처음 올라옴',
    status: { word: '취소됐어요', detail: '10/27(화) 15시 특강', tone: 'closed' },
    collapsed: 'cancelled',
    blocks: [
      {
        label: '언제·어디',
        lines: [
          { text: '10/27(화) 15시~16시 30분', sub: '경영관 33101호', quote: '일시: 2026. 10. 27.(화) 15:00~16:30' },
        ],
      },
    ],
    original: {
      posters: 0,
      attachments: [],
      links: [],
      body: '강사 사정으로 10월 27일(화) 면접 전략 특강이 취소되었습니다.',
    },
  },
  {
    id: 'survey',
    originalTitle: '[학생지원팀] 학생식당 만족도 설문조사 (조기 마감)',
    board: '학생지원팀',
    firstSeen: '어제 처음 올라옴',
    status: { word: '마감됨', detail: '10/26(월) 조기 마감', tone: 'closed' },
    collapsed: 'closed',
    blocks: [
      {
        label: '혜택',
        lines: [{ text: '커피 쿠폰 (추첨 50명)', quote: '추첨을 통해 50명에게 커피 쿠폰' }],
      },
    ],
    original: {
      posters: 1,
      attachments: [],
      links: [{ role: '설문 링크', domain: 'forms.gle' }],
      body: '목표 인원이 달성되어 설문을 조기 마감합니다.',
    },
  },
  {
    id: 'checkup',
    originalTitle: '2026년 교직원 정기 건강검진 실시 안내',
    board: '인사팀',
    firstSeen: '이번 주 처음 올라옴',
    staffOnly: true,
    blocks: [],
    original: {
      posters: 0,
      attachments: [{ role: '검진 기관 목록', name: '검진기관.pdf' }],
      links: [],
      body: '2026년 교직원 정기 건강검진을 11월 중순에 실시합니다.',
    },
  },
];

export function sketchDetailFor(id: string): SketchDetail | null {
  const own = DETAILS.find((detail) => detail.id === id);
  if (own) return own;
  const row = SKETCH_ROWS.find((r) => r.id === id);
  if (!row) return null;
  return {
    id,
    originalTitle: row.title,
    board: row.board ?? '학과 공지',
    firstSeen: `${SKETCH_DAY_LABEL[row.day]} 처음 올라옴`,
    englishOnly: row.englishOnly,
    blocks: [],
    original: { posters: 0, attachments: [], links: [], body: '(원문 본문)' },
  };
}
