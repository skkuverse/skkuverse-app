/** The display title, over every distinct title in the mock (real university notices). */

import { describe, expect, it } from 'vitest';
import { TITLE_LIMIT, TOKEN_TITLE_LIMIT, toRowTitle, toShortTitle, toTitleWidth } from './short-title.rules';

describe('toShortTitle', () => {
  it.each([
    ['2027학년도 2학기 해외파견 교환학생 설명회 및 Student Mobility Fair 안내', '해외파견 교환학생 설명회 및 Student Mobility Fair'],
    ['제41회 소셜이노베이션 취/창업 콜로키움(10/27(화), 수선관61901호)', '소셜이노베이션 취/창업 콜로키움'],
    ['[학생인재개발팀] 2026학년도 2학기 국가고시 및 전문자격증 설명회 참가 신청', '국가고시 및 전문자격증 설명회'],
    ['[인공지능혁신융합대학사업단] AICOSS 사업단 설명회 참석 안내', 'AICOSS 사업단 설명회'],
    ['2026년 졸업앨범 추가 촬영 안내', '졸업앨범 추가 촬영'],
    ['(성균인성교육센터) 2026-2 성균인의 자기이해 <인성함양 실천 특별프로그램 [성균]> 참가자 모집', '인성함양 실천 특별프로그램'],
    ['[학생인재개발팀/대학일자리플러스센터] 삼양그룹 임원 설명회', '삼양그룹 임원 설명회'],
    ['Prof. Michael Naef (Durham) 신경경제학(Neuroeconomics) 특강 (11/3)', 'Prof. Michael Naef (Durham) 신경경제학(Neuroeconomics) 특강'],
    ['제40회 학생성공스토리 특강: 규제정책과 정치의 효능(박용진 선배, 사회학과 90)', '학생성공스토리 특강: 규제정책과 정치의 효능(박용진 선배, 사회학과 90)'],
    ['[삼성학술정보관] 2026년 10월 시네마룸 상영영화 안내', '10월 시네마룸 상영영화'],
    ['2026 하반기 졸업선배 릴레이 특강(10,11월): 삼성전자, 우리카드', '졸업선배 릴레이 특강: 삼성전자, 우리카드'],
    ['[KUSF 두드림] 스포츠단 농구부 재능 기부 프로그램 참여자 모집 (창의품 10시간 지급)', '스포츠단 농구부 재능 기부 프로그램'],
    ['[KUSF 두드림] 스포츠단 검도부 재능 기부 프로그램 참여자 모집 (창의품 16시간 지급)', '스포츠단 검도부 재능 기부 프로그램'],
    ['[대학혁신과공유센터] 인텐시브 워크숍 <바이브코딩으로 게임 만들기(with NC AI)> 참가 모집(모집 연장)', '바이브코딩으로 게임 만들기 워크숍'],
    ['[세미나] 양자정보연구지원센터 2026 제4회 양자정보세미나 개최 안내', '양자정보세미나'],
    ['[학생성공센터]제39회 학생성공스토리 특강: "창업을 배우고 도전을 만나다"', '창업을 배우고 도전을 만나다'],
    ['[공학교육혁신센터] 2026 공학페스티벌 서포터즈「E² 메이트」모집 안내(~10/22(목)까지)', 'E² 메이트 서포터즈'],
  ])('%s', (title, short) => {
    // Act & Assert
    expect(toShortTitle(title)).toBe(short);
  });

  it('never strips a title to nothing', () => {
    // Act & Assert
    expect(toShortTitle('[안내] 안내')).toBe('안내');
    expect(toShortTitle('[공지]')).toBe('[공지]');
  });

  it('keeps no kind word after a quoted sentence, and one after a quoted name', () => {
    // Act & Assert
    expect(toShortTitle('특강: "함께 걷는다"')).toBe('함께 걷는다');
    expect(toShortTitle('특강 <함께 걷기>')).toBe('함께 걷기 특강');
  });
});

describe('toRowTitle: at most 20 characters, never cut mid-word', () => {
  it.each([
    ['교환학생 설명회·Mobility Fair', '교환학생 설명회·Mobility Fair'],
    ['AI in Higher Education', 'AI in Higher Education'],
    ['해외파견 교환학생 설명회 및 Student Mobility Fair', '해외파견 교환학생 설명회 및 Student…'],
    ['학생성공스토리 특강: 규제정책과 정치의 효능(박용진 선배, 사회학과 90)', '학생성공스토리 특강: 규제정책과 정치의…'],
    ['  졸업앨범   추가 촬영 ', '졸업앨범 추가 촬영'],
  ])('%s', (title, row) => {
    // Act
    const shown = toRowTitle(title);

    // Assert
    expect(shown).toBe(row);
    expect(toTitleWidth(shown)).toBeLessThanOrEqual(TITLE_LIMIT);
  });

  it('cuts a single word longer than the limit, the one case it cannot keep whole', () => {
    // Arrange
    const word = '가'.repeat(30);

    // Act
    const shown = toRowTitle(word);

    // Assert
    expect(shown).toBe(`${'가'.repeat(19)}…`);
  });

  it('counts a full-width glyph as one character and a half-width one as a half', () => {
    // Act & Assert
    expect(toTitleWidth('설명회')).toBe(3);
    expect(toTitleWidth('AI 특강')).toBe(3.5);
  });
});

describe('toRowTitle under a token: at most 14 characters (ADR 0010 D5)', () => {
  it.each([
    ['교환학생 설명회·Mobility Fair', '교환학생 설명회·Mobility…'],
    ['성균인의 자기이해 특별프로그램', '성균인의 자기이해…'],
    ['국가고시·전문자격증 설명회', '국가고시·전문자격증 설명회'],
    ['검도 재능 기부 프로그램', '검도 재능 기부 프로그램'],
  ])('%s', (title, row) => {
    // Act
    const shown = toRowTitle(title, TOKEN_TITLE_LIMIT);

    // Assert
    expect(shown).toBe(row);
    expect(toTitleWidth(shown)).toBeLessThanOrEqual(TOKEN_TITLE_LIMIT);
  });

  it('is 14, six under the plain limit', () => {
    // Act & Assert
    expect([TITLE_LIMIT, TOKEN_TITLE_LIMIT]).toStrictEqual([20, 14]);
  });
});
