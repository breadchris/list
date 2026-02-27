import svgPaths from "./svg-d0oi33duag";
import imgImageClassicHomemadePasta from "figma:asset/c59aad1690fac3fb4bf020ffb377687935fcb886.png";

function Icon() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d="M8 4.66667V14" id="Vector" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p8c8fb00} id="Vector_2" stroke="var(--stroke-0, white)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Container2() {
  return (
    <div className="relative rounded-[4px] shrink-0 size-[24px]" data-name="Container" style={{ backgroundImage: "linear-gradient(135deg, rgb(246, 51, 154) 0%, rgb(251, 44, 54) 100%)" }}>
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon />
      </div>
    </div>
  );
}

function Text() {
  return (
    <div className="flex-[1_0_0] h-[24px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[24px] left-0 not-italic text-[#101828] text-[16px] top-[-0.5px] tracking-[-0.3125px]">Storybook</p>
      </div>
    </div>
  );
}

function Container1() {
  return (
    <div className="h-[24px] relative shrink-0 w-[110.93px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Container2 />
        <Text />
      </div>
    </div>
  );
}

function Icon1() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[8.33%_12.43%]" data-name="Vector">
        <div className="absolute inset-[-5%_-5.54%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 13.3568 14.6667">
            <path d={svgPaths.p311dbd80} id="Vector" stroke="var(--stroke-0, #6A7282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[37.5%]" data-name="Vector">
        <div className="absolute inset-[-16.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.33333 5.33333">
            <path d={svgPaths.p36446d40} id="Vector" stroke="var(--stroke-0, #6A7282)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="relative rounded-[4px] shrink-0 size-[24px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[4px] px-[4px] relative size-full">
        <Icon1 />
      </div>
    </div>
  );
}

export function Container() {
  return (
    <div className="h-[49px] relative shrink-0 w-[255px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-between pb-px px-[16px] relative size-full">
        <Container1 />
        <Button />
      </div>
    </div>
  );
}

function Text1() {
  return (
    <div className="h-[20px] relative shrink-0 w-[14px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#6a7282] text-[14px] top-[0.5px] tracking-[-0.1504px]">🔍</p>
      </div>
    </div>
  );
}

function Text2() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#6a7282] text-[14px] top-[0.5px] tracking-[-0.1504px]">Find components</p>
      </div>
    </div>
  );
}

function Text3() {
  return (
    <div className="h-[16px] relative shrink-0 w-[3.656px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6a7282] text-[12px] top-px">/</p>
      </div>
    </div>
  );
}

function Container4() {
  return (
    <div className="bg-[#f9fafb] h-[34px] relative rounded-[4px] shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[4px]" />
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center px-[13px] py-px relative size-full">
          <Text1 />
          <Text2 />
          <Text3 />
        </div>
      </div>
    </div>
  );
}

export function Container3() {
  return (
    <div className="h-[59px] relative shrink-0 w-[255px]" data-name="Container">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pb-px pt-[12px] px-[12px] relative size-full">
        <Container4 />
      </div>
    </div>
  );
}

function Text4() {
  return <div className="h-0 shrink-0 w-[16px]" data-name="Text" />;
}

function Text5() {
  return (
    <div className="h-[16px] relative shrink-0 w-[12px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#99a1af] text-[12px] top-px">📖</p>
      </div>
    </div>
  );
}

function Text6() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">Introduction</p>
      </div>
    </div>
  );
}

function Container7() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center px-[12px] relative size-full">
          <Text4 />
          <Text5 />
          <Text6 />
        </div>
      </div>
    </div>
  );
}

function Icon2() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Icon">
          <path d="M4.5 9L7.5 6L4.5 3" id="Vector" stroke="var(--stroke-0, #364153)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Text7() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon2 />
      </div>
    </div>
  );
}

function Text8() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">DATA</p>
      </div>
    </div>
  );
}

function Container8() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center px-[12px] relative size-full">
          <Text7 />
          <Text8 />
        </div>
      </div>
    </div>
  );
}

function Icon3() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Icon">
          <path d="M3 4.5L6 7.5L9 4.5" id="Vector" stroke="var(--stroke-0, #364153)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Text9() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon3 />
      </div>
    </div>
  );
}

function Text10() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">UI COMPONENTS</p>
      </div>
    </div>
  );
}

function Container10() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center px-[12px] relative size-full">
          <Text9 />
          <Text10 />
        </div>
      </div>
    </div>
  );
}

function Text11() {
  return <div className="h-0 shrink-0 w-[16px]" data-name="Text" />;
}

function Text12() {
  return (
    <div className="h-[16px] relative shrink-0 w-[12px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[12px] text-white top-px">🃏</p>
      </div>
    </div>
  );
}

function Text13() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[14px] text-white top-[0.5px] tracking-[-0.1504px]">Card Component</p>
      </div>
    </div>
  );
}

function Container12() {
  return (
    <div className="bg-[#2b7fff] h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center pl-[24px] pr-[12px] relative size-full">
          <Text11 />
          <Text12 />
          <Text13 />
        </div>
      </div>
    </div>
  );
}

function Icon4() {
  return (
    <div className="relative shrink-0 size-[12px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 12">
        <g id="Icon">
          <path d="M3 4.5L6 7.5L9 4.5" id="Vector" stroke="var(--stroke-0, #364153)" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
}

function Text14() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon4 />
      </div>
    </div>
  );
}

function Text15() {
  return (
    <div className="h-[16px] relative shrink-0 w-[12px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#99a1af] text-[12px] top-px">📁</p>
      </div>
    </div>
  );
}

function Text16() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">Content Sections</p>
      </div>
    </div>
  );
}

function Container14() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center pl-[24px] pr-[12px] relative size-full">
          <Text14 />
          <Text15 />
          <Text16 />
        </div>
      </div>
    </div>
  );
}

function Text17() {
  return <div className="h-0 shrink-0 w-[16px]" data-name="Text" />;
}

function Text18() {
  return (
    <div className="h-[16px] relative shrink-0 w-[12px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#99a1af] text-[12px] top-px">📄</p>
      </div>
    </div>
  );
}

function Text19() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">Plan Section</p>
      </div>
    </div>
  );
}

function Container16() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center pl-[36px] pr-[12px] relative size-full">
          <Text17 />
          <Text18 />
          <Text19 />
        </div>
      </div>
    </div>
  );
}

function Text20() {
  return <div className="h-0 shrink-0 w-[16px]" data-name="Text" />;
}

function Text21() {
  return (
    <div className="h-[16px] relative shrink-0 w-[12px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#99a1af] text-[12px] top-px">📄</p>
      </div>
    </div>
  );
}

function Text22() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">Prep Section</p>
      </div>
    </div>
  );
}

function Container17() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center pl-[36px] pr-[12px] relative size-full">
          <Text20 />
          <Text21 />
          <Text22 />
        </div>
      </div>
    </div>
  );
}

function Text23() {
  return <div className="h-0 shrink-0 w-[16px]" data-name="Text" />;
}

function Text24() {
  return (
    <div className="h-[16px] relative shrink-0 w-[12px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#99a1af] text-[12px] top-px">📄</p>
      </div>
    </div>
  );
}

function Text25() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">Cook Section</p>
      </div>
    </div>
  );
}

function Container18() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center pl-[36px] pr-[12px] relative size-full">
          <Text23 />
          <Text24 />
          <Text25 />
        </div>
      </div>
    </div>
  );
}

function Container15() {
  return (
    <div className="content-stretch flex flex-col h-[96px] items-start relative shrink-0 w-full" data-name="Container">
      <Container16 />
      <Container17 />
      <Container18 />
    </div>
  );
}

function Container13() {
  return (
    <div className="content-stretch flex flex-col h-[128px] items-start relative shrink-0 w-full" data-name="Container">
      <Container14 />
      <Container15 />
    </div>
  );
}

function Text26() {
  return <div className="h-0 shrink-0 w-[16px]" data-name="Text" />;
}

function Text27() {
  return (
    <div className="h-[16px] relative shrink-0 w-[12px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#99a1af] text-[12px] top-px">📋</p>
      </div>
    </div>
  );
}

function Text28() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">Full View</p>
      </div>
    </div>
  );
}

function Container19() {
  return (
    <div className="h-[32px] relative shrink-0 w-full" data-name="Container">
      <div className="flex flex-row items-center size-full">
        <div className="content-stretch flex gap-[8px] items-center pl-[24px] pr-[12px] relative size-full">
          <Text26 />
          <Text27 />
          <Text28 />
        </div>
      </div>
    </div>
  );
}

function Container11() {
  return (
    <div className="content-stretch flex flex-col h-[192px] items-start relative shrink-0 w-full" data-name="Container">
      <Container12 />
      <Container13 />
      <Container19 />
    </div>
  );
}

function Container9() {
  return (
    <div className="content-stretch flex flex-col h-[224px] items-start relative shrink-0 w-full" data-name="Container">
      <Container10 />
      <Container11 />
    </div>
  );
}

function Container6() {
  return (
    <div className="content-stretch flex flex-col h-[304px] items-start pt-[8px] relative shrink-0 w-full" data-name="Container">
      <Container7 />
      <Container8 />
      <Container9 />
    </div>
  );
}

export function Container5() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[255px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <Container6 />
      </div>
    </div>
  );
}

export function Cn() {
  return (
    <div className="bg-white h-full relative shrink-0 w-[256px]" data-name="Cn">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-r border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pr-px relative size-full">
        <Container />
        <Container3 />
        <Container5 />
      </div>
    </div>
  );
}

function Icon5() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[8.33%_20.83%]" data-name="Vector">
        <div className="absolute inset-[-5%_-7.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10.6667 14.6667">
            <path d={svgPaths.p3d24c340} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/4 left-1/2 right-[49.96%] top-3/4" data-name="Vector">
        <div className="absolute inset-[-0.67px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.34 1.33333">
            <path d="M0.666667 0.666667H0.673334" id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button1() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-0 pt-[8px] px-[8px] rounded-[4px] size-[32px] top-0" data-name="Button">
      <Icon5 />
    </div>
  );
}

function Icon6() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[8.33%_16.67%]" data-name="Vector">
        <div className="absolute inset-[-5%_-6.25%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 12 14.6667">
            <path d={svgPaths.p2a95d000} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-1/4 left-1/2 right-[49.96%] top-3/4" data-name="Vector">
        <div className="absolute inset-[-0.67px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.34 1.33333">
            <path d="M0.666667 0.666667H0.673334" id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button2() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[40px] pt-[8px] px-[8px] rounded-[4px] size-[32px] top-0" data-name="Button">
      <Icon6 />
    </div>
  );
}

function Icon7() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[12.5%_8.33%_29.17%_8.33%]" data-name="Vector">
        <div className="absolute inset-[-7.14%_-5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 14.6667 10.6667">
            <path d={svgPaths.pb5eef70} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[87.5%_33.33%_12.5%_33.33%]" data-name="Vector">
        <div className="absolute inset-[-0.67px_-12.5%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 6.66667 1.33333">
            <path d="M0.666667 0.666667H6" id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute bottom-[12.5%] left-1/2 right-1/2 top-[70.83%]" data-name="Vector">
        <div className="absolute inset-[-25%_-0.67px]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1.33333 4">
            <path d="M0.666667 0.666667V3.33333" id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button3() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-[80px] pt-[8px] px-[8px] rounded-[4px] size-[32px] top-0" data-name="Button">
      <Icon7 />
    </div>
  );
}

function Container22() {
  return <div className="absolute bg-[#e5e7eb] h-[24px] left-[128px] top-[4px] w-px" data-name="Container" />;
}

function Text29() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[20px] left-0 not-italic text-[#4a5565] text-[14px] top-[0.5px] tracking-[-0.1504px]">100%</p>
      </div>
    </div>
  );
}

function Container23() {
  return (
    <div className="absolute content-stretch flex h-[20px] items-center left-[145px] top-[6px] w-[36.484px]" data-name="Container">
      <Text29 />
    </div>
  );
}

export function Container21() {
  return (
    <div className="h-[32px] relative shrink-0 w-[181.484px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <Button1 />
        <Button2 />
        <Button3 />
        <Container22 />
        <Container23 />
      </div>
    </div>
  );
}

function Icon8() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[33.33%_8.33%_8.33%_33.33%]" data-name="Vector">
        <div className="absolute inset-[-7.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10.6667 10.6667">
            <path d={svgPaths.p4611e00} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[8.33%_33.33%_33.33%_8.33%]" data-name="Vector">
        <div className="absolute inset-[-7.14%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 10.6667 10.6667">
            <path d={svgPaths.p26970a80} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button4() {
  return (
    <div className="relative rounded-[4px] shrink-0 size-[32px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[8px] px-[8px] relative size-full">
        <Icon8 />
      </div>
    </div>
  );
}

function Icon9() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[8.33%_12.5%_66.67%_62.5%]" data-name="Vector">
        <div className="absolute inset-[-16.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.33333 5.33333">
            <path d={svgPaths.p36446d40} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[37.5%_62.5%_37.5%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-16.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.33333 5.33333">
            <path d={svgPaths.p36446d40} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[66.67%_12.5%_8.33%_62.5%]" data-name="Vector">
        <div className="absolute inset-[-16.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.33333 5.33333">
            <path d={svgPaths.p36446d40} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[56.29%_35.75%_27.12%_35.79%]" data-name="Vector">
        <div className="absolute inset-[-25.13%_-14.64%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.88688 3.98688">
            <path d={svgPaths.p3e007700} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[27.13%_35.79%_56.29%_35.79%]" data-name="Vector">
        <div className="absolute inset-[-25.13%_-14.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.88022 3.98688">
            <path d={svgPaths.p309e7540} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button5() {
  return (
    <div className="relative rounded-[4px] shrink-0 size-[32px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[8px] px-[8px] relative size-full">
        <Icon9 />
      </div>
    </div>
  );
}

function Icon10() {
  return (
    <div className="h-[16px] overflow-clip relative shrink-0 w-full" data-name="Icon">
      <div className="absolute inset-[12.5%_12.5%_62.5%_62.5%]" data-name="Vector">
        <div className="absolute inset-[-16.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.33333 5.33333">
            <path d={svgPaths.p1efb2580} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[62.5%_62.5%_12.5%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-16.67%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 5.33333 5.33333">
            <path d={svgPaths.p39dbf080} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[12.5%_12.5%_58.33%_58.33%]" data-name="Vector">
        <div className="absolute inset-[-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 6 6">
            <path d={svgPaths.p19399880} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
      <div className="absolute inset-[58.33%_58.33%_12.5%_12.5%]" data-name="Vector">
        <div className="absolute inset-[-14.29%]">
          <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 6 6">
            <path d={svgPaths.p3822980} id="Vector" stroke="var(--stroke-0, #4A5565)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Button6() {
  return (
    <div className="flex-[1_0_0] h-[32px] min-h-px min-w-px relative rounded-[4px]" data-name="Button">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start pt-[8px] px-[8px] relative size-full">
        <Icon10 />
      </div>
    </div>
  );
}

export function Container24() {
  return (
    <div className="h-[32px] relative shrink-0 w-[112px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex gap-[8px] items-center relative size-full">
        <Button4 />
        <Button5 />
        <Button6 />
      </div>
    </div>
  );
}

export function Sn() {
  return (
    <div className="bg-white h-[48px] relative shrink-0 w-full" data-name="Sn">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-between pb-px px-[16px] relative size-full">
        <Container21 />
        <Container24 />
      </div>
    </div>
  );
}

function Heading() {
  return (
    <div className="absolute content-stretch flex h-[36px] items-start left-0 top-0 w-[1039px]" data-name="Heading 1">
      <p className="flex-[1_0_0] font-['Inter:Bold',sans-serif] font-bold leading-[36px] min-h-px min-w-px not-italic relative text-[#101828] text-[30px] tracking-[0.3955px] whitespace-pre-wrap">Card Component</p>
    </div>
  );
}

function Paragraph() {
  return (
    <div className="absolute h-[24px] left-0 top-[44px] w-[768px]" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[24px] left-0 not-italic text-[#4a5565] text-[16px] top-[-0.5px] tracking-[-0.3125px]">Overview card component.</p>
    </div>
  );
}

function Container27() {
  return (
    <div className="h-[68px] relative shrink-0 w-full" data-name="Container">
      <Heading />
      <Paragraph />
    </div>
  );
}

function ImageClassicHomemadePasta() {
  return (
    <div className="h-[285px] relative shrink-0 w-full" data-name="Image (Classic Homemade Pasta)">
      <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={imgImageClassicHomemadePasta} />
    </div>
  );
}

function Do() {
  return (
    <div className="bg-[#f3f4f6] flex-[1_0_0] min-h-px min-w-px relative w-[380px]" data-name="Do">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <ImageClassicHomemadePasta />
      </div>
    </div>
  );
}

function Heading1() {
  return (
    <div className="h-[25px] relative shrink-0 w-[249.977px]" data-name="Heading 3">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Bold',sans-serif] font-bold leading-[25px] left-0 not-italic text-[#101828] text-[20px] top-[-0.5px] tracking-[-0.4492px]">Card Title</p>
      </div>
    </div>
  );
}

function Xt() {
  return (
    <div className="bg-[#fef3c6] h-[24px] relative rounded-[8px] shrink-0 w-[67.086px]" data-name="Xt">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center overflow-clip px-[10px] py-[4px] relative rounded-[inherit] size-full">
        <p className="font-['Inter:Semi_Bold',sans-serif] font-semibold leading-[16px] not-italic relative shrink-0 text-[#973c00] text-[12px]">Medium</p>
      </div>
      <div aria-hidden="true" className="absolute border-2 border-[#ffd230] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function Container29() {
  return (
    <div className="content-stretch flex h-[25px] items-start justify-between relative shrink-0 w-full" data-name="Container">
      <Heading1 />
      <Xt />
    </div>
  );
}

function Paragraph1() {
  return (
    <div className="h-[52px] overflow-clip relative shrink-0 w-full" data-name="Paragraph">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[26px] left-0 not-italic text-[#4a5565] text-[16px] top-[-0.5px] tracking-[-0.3125px] w-[332px] whitespace-pre-wrap">Card description text.</p>
    </div>
  );
}

function Icon11() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g clipPath="url(#clip0_16_621)" id="Icon">
          <path d={svgPaths.p39ee6532} id="Vector" stroke="var(--stroke-0, #155DFC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M8 4V8L10.6667 9.33333" id="Vector_2" stroke="var(--stroke-0, #155DFC)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
        <defs>
          <clipPath id="clip0_16_621">
            <rect fill="white" height="16" width="16" />
          </clipPath>
        </defs>
      </svg>
    </div>
  );
}

function Container32() {
  return (
    <div className="bg-[#dbeafe] relative rounded-[10px] shrink-0 size-[32px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon11 />
      </div>
    </div>
  );
}

function Text30() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#4a5565] text-[14px] top-[0.5px] tracking-[-0.1504px]">Meta 1</p>
      </div>
    </div>
  );
}

function Container31() {
  return (
    <div className="absolute content-stretch flex gap-[8px] h-[32px] items-center left-0 top-0 w-[85.5px]" data-name="Container">
      <Container32 />
      <Text30 />
    </div>
  );
}

function Icon12() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d={svgPaths.p32887f80} id="Vector" stroke="var(--stroke-0, #009966)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p3694d280} id="Vector_2" stroke="var(--stroke-0, #009966)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p1f197700} id="Vector_3" stroke="var(--stroke-0, #009966)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d={svgPaths.p3bf3e100} id="Vector_4" stroke="var(--stroke-0, #009966)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Container34() {
  return (
    <div className="bg-[#d0fae5] relative rounded-[10px] shrink-0 size-[32px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon12 />
      </div>
    </div>
  );
}

function Text31() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#4a5565] text-[14px] top-[0.5px] tracking-[-0.1504px] w-[69px] whitespace-pre-wrap">Meta 2</p>
      </div>
    </div>
  );
}

function Container33() {
  return (
    <div className="absolute content-stretch flex gap-[8px] h-[32px] items-center left-[105.5px] top-0 w-[108.914px]" data-name="Container">
      <Container34 />
      <Text31 />
    </div>
  );
}

function Icon13() {
  return (
    <div className="relative shrink-0 size-[16px]" data-name="Icon">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 16 16">
        <g id="Icon">
          <path d={svgPaths.p154d1600} id="Vector" stroke="var(--stroke-0, #F54900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
          <path d="M4 11.3333H12" id="Vector_2" stroke="var(--stroke-0, #F54900)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.33333" />
        </g>
      </svg>
    </div>
  );
}

function Container36() {
  return (
    <div className="bg-[#ffedd4] relative rounded-[10px] shrink-0 size-[32px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center relative size-full">
        <Icon13 />
      </div>
    </div>
  );
}

function Text32() {
  return (
    <div className="flex-[1_0_0] h-[20px] min-h-px min-w-px relative" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#4a5565] text-[14px] top-[0.5px] tracking-[-0.1504px]">Meta 3</p>
      </div>
    </div>
  );
}

function Container35() {
  return (
    <div className="absolute content-stretch flex gap-[8px] h-[32px] items-center left-0 top-[52px] w-[138.617px]" data-name="Container">
      <Container36 />
      <Text32 />
    </div>
  );
}

function Container30() {
  return (
    <div className="h-[84px] relative shrink-0 w-full" data-name="Container">
      <Container31 />
      <Container33 />
      <Container35 />
    </div>
  );
}

function Do1() {
  return (
    <div className="h-[241px] relative shrink-0 w-[380px]" data-name="Do">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col gap-[12px] items-start pt-[24px] px-[24px] relative size-full">
        <Container29 />
        <Paragraph1 />
        <Container30 />
      </div>
    </div>
  );
}

export function Ne() {
  return (
    <div className="bg-white h-[554px] relative rounded-[14px] shrink-0 w-full" data-name="Ne">
      <div className="content-stretch flex flex-col gap-[24px] items-start overflow-clip p-[2px] relative rounded-[inherit] size-full">
        <Do />
        <Do1 />
      </div>
      <div aria-hidden="true" className="absolute border-2 border-[rgba(0,0,0,0.1)] border-solid inset-0 pointer-events-none rounded-[14px]" />
    </div>
  );
}

function Container28() {
  return (
    <div className="bg-white h-[636px] relative rounded-[14px] shrink-0 w-full" data-name="Container">
      <div aria-hidden="true" className="absolute border border-[#e5e7eb] border-solid inset-0 pointer-events-none rounded-[14px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_0px_rgba(0,0,0,0.1)]" />
      <div className="content-stretch flex flex-col items-start pb-px pl-[41px] pr-[614px] pt-[41px] relative size-full">
        <Ne />
      </div>
    </div>
  );
}

function Y() {
  return (
    <div className="bg-[#f9fafb] h-[800px] relative shrink-0 w-full" data-name="Y">
      <div className="overflow-clip rounded-[inherit] size-full">
        <div className="content-stretch flex flex-col gap-[32px] items-start pt-[32px] px-[32px] relative size-full">
          <Container27 />
          <Container28 />
        </div>
      </div>
    </div>
  );
}

function Container26() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[1103px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <Y />
      </div>
    </div>
  );
}

function Nt1() {
  return (
    <div className="absolute bg-[#e5e7eb] h-[20px] left-[208.93px] rounded-[4px] top-[9px] w-[19.898px]" data-name="nt">
      <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[16px] left-[10px] not-italic text-[#364153] text-[12px] text-center top-[3px]">4</p>
    </div>
  );
}

function PrimitiveButton() {
  return (
    <div className="flex-[1_0_0] h-[39px] min-h-px min-w-px relative" data-name="Primitive.button">
      <div aria-hidden="true" className="absolute border-[#2b7fff] border-b-2 border-l border-r border-solid border-t inset-0 pointer-events-none" />
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="-translate-x-1/2 absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-[166.83px] not-italic text-[#0a0a0a] text-[14px] text-center top-[9.5px] tracking-[-0.1504px]">Controls</p>
        <Nt1 />
      </div>
    </div>
  );
}

function PrimitiveButton1() {
  return (
    <div className="flex-[1_0_0] h-[39px] min-h-px min-w-px relative" data-name="Primitive.button">
      <div aria-hidden="true" className="absolute border-[rgba(0,0,0,0)] border-b-2 border-l border-r border-solid border-t inset-0 pointer-events-none" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center pb-[10px] pt-[9px] px-[17px] relative size-full">
          <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20px] not-italic relative shrink-0 text-[#0a0a0a] text-[14px] text-center tracking-[-0.1504px]">Actions</p>
        </div>
      </div>
    </div>
  );
}

function PrimitiveButton2() {
  return (
    <div className="flex-[1_0_0] h-[39px] min-h-px min-w-px relative" data-name="Primitive.button">
      <div aria-hidden="true" className="absolute border-[rgba(0,0,0,0)] border-b-2 border-l border-r border-solid border-t inset-0 pointer-events-none" />
      <div className="flex flex-row items-center justify-center size-full">
        <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex items-center justify-center pb-[10px] pt-[9px] px-[17px] relative size-full">
          <p className="font-['Inter:Medium',sans-serif] font-medium leading-[20px] not-italic relative shrink-0 text-[#0a0a0a] text-[14px] text-center tracking-[-0.1504px]">Accessibility</p>
        </div>
      </div>
    </div>
  );
}

function TabList() {
  return (
    <div className="absolute content-stretch flex h-[40px] items-center left-0 pb-px pr-[0.008px] top-0 w-[1103px]" data-name="Tab List">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-b border-solid inset-0 pointer-events-none" />
      <PrimitiveButton />
      <PrimitiveButton1 />
      <PrimitiveButton2 />
    </div>
  );
}

function HeaderCell() {
  return (
    <div className="absolute h-[36.5px] left-0 top-0 w-[386.039px]" data-name="Header Cell">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#4a5565] text-[14px] top-[8.5px] tracking-[-0.1504px]">Name</p>
    </div>
  );
}

function HeaderCell1() {
  return (
    <div className="absolute h-[36.5px] left-[386.04px] top-0 w-[684.961px]" data-name="Header Cell">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#4a5565] text-[14px] top-[8.5px] tracking-[-0.1504px]">Control</p>
    </div>
  );
}

function TableRow() {
  return (
    <div className="absolute border-[#e5e7eb] border-b border-solid h-[36.5px] left-0 top-0 w-[1071px]" data-name="Table Row">
      <HeaderCell />
      <HeaderCell1 />
    </div>
  );
}

function TableHeader() {
  return (
    <div className="absolute h-[36.5px] left-0 top-0 w-[1071px]" data-name="Table Header">
      <TableRow />
    </div>
  );
}

function Container38() {
  return (
    <div className="absolute h-[20px] left-0 top-[12.5px] w-[370.039px]" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#101828] text-[14px] top-[0.5px] tracking-[-0.1504px]">selectedRecipeId</p>
    </div>
  );
}

function Container39() {
  return (
    <div className="absolute h-[16px] left-0 top-[34.5px] w-[370.039px]" data-name="Container">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6a7282] text-[12px] top-px">Select recipe data to display</p>
    </div>
  );
}

function TableCell() {
  return (
    <div className="absolute h-[63px] left-0 top-0 w-[386.039px]" data-name="Table Cell">
      <Container38 />
      <Container39 />
    </div>
  );
}

function Option() {
  return <div className="absolute left-[-659.04px] size-0 top-[-854.75px]" data-name="Option" />;
}

function Option1() {
  return <div className="absolute left-[-659.04px] size-0 top-[-854.75px]" data-name="Option" />;
}

function Option2() {
  return <div className="absolute left-[-659.04px] size-0 top-[-854.75px]" data-name="Option" />;
}

function Dropdown() {
  return (
    <div className="absolute border border-[#d1d5dc] border-solid h-[32.5px] left-0 rounded-[4px] top-[15.25px] w-[684.961px]" data-name="Dropdown">
      <Option />
      <Option1 />
      <Option2 />
    </div>
  );
}

function TableCell1() {
  return (
    <div className="absolute h-[63px] left-[386.04px] top-0 w-[684.961px]" data-name="Table Cell">
      <Dropdown />
    </div>
  );
}

function TableRow1() {
  return (
    <div className="absolute border-[#f3f4f6] border-b border-solid h-[63px] left-0 top-0 w-[1071px]" data-name="Table Row">
      <TableCell />
      <TableCell1 />
    </div>
  );
}

function Container40() {
  return (
    <div className="absolute h-[20px] left-0 top-[12.5px] w-[370.039px]" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#101828] text-[14px] top-[0.5px] tracking-[-0.1504px]">difficulty</p>
    </div>
  );
}

function Container41() {
  return (
    <div className="absolute h-[16px] left-0 top-[34.5px] w-[370.039px]" data-name="Container">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6a7282] text-[12px] top-px">Recipe difficulty level</p>
    </div>
  );
}

function TableCell2() {
  return (
    <div className="absolute h-[63px] left-0 top-0 w-[386.039px]" data-name="Table Cell">
      <Container40 />
      <Container41 />
    </div>
  );
}

function Option3() {
  return <div className="absolute left-[-659.04px] size-0 top-[-917.75px]" data-name="Option" />;
}

function Option4() {
  return <div className="absolute left-[-659.04px] size-0 top-[-917.75px]" data-name="Option" />;
}

function Option5() {
  return <div className="absolute left-[-659.04px] size-0 top-[-917.75px]" data-name="Option" />;
}

function Dropdown1() {
  return (
    <div className="absolute border border-[#d1d5dc] border-solid h-[32.5px] left-0 rounded-[4px] top-[15.25px] w-[684.961px]" data-name="Dropdown">
      <Option3 />
      <Option4 />
      <Option5 />
    </div>
  );
}

function TableCell3() {
  return (
    <div className="absolute h-[63px] left-[386.04px] top-0 w-[684.961px]" data-name="Table Cell">
      <Dropdown1 />
    </div>
  );
}

function TableRow2() {
  return (
    <div className="absolute border-[#f3f4f6] border-b border-solid h-[63px] left-0 top-[63px] w-[1071px]" data-name="Table Row">
      <TableCell2 />
      <TableCell3 />
    </div>
  );
}

function Container42() {
  return (
    <div className="absolute h-[20px] left-0 top-[12.5px] w-[370.039px]" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#101828] text-[14px] top-[0.5px] tracking-[-0.1504px]">showImage</p>
    </div>
  );
}

function Container43() {
  return (
    <div className="absolute h-[16px] left-0 top-[34.5px] w-[370.039px]" data-name="Container">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6a7282] text-[12px] top-px">Show recipe image</p>
    </div>
  );
}

function TableCell4() {
  return (
    <div className="absolute h-[63px] left-0 top-0 w-[386.039px]" data-name="Table Cell">
      <Container42 />
      <Container43 />
    </div>
  );
}

function Checkbox() {
  return <div className="shrink-0 size-[16px]" data-name="Checkbox" />;
}

function Text33() {
  return (
    <div className="h-[20px] relative shrink-0 w-[26.813px]" data-name="Text">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid relative size-full">
        <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#364153] text-[14px] top-[0.5px] tracking-[-0.1504px]">true</p>
      </div>
    </div>
  );
}

function Label() {
  return (
    <div className="absolute content-stretch flex gap-[8px] h-[20px] items-center left-0 top-[21.5px] w-[684.961px]" data-name="Label">
      <Checkbox />
      <Text33 />
    </div>
  );
}

function TableCell5() {
  return (
    <div className="absolute h-[63px] left-[386.04px] top-0 w-[684.961px]" data-name="Table Cell">
      <Label />
    </div>
  );
}

function TableRow3() {
  return (
    <div className="absolute border-[#f3f4f6] border-b border-solid h-[63px] left-0 top-[126px] w-[1071px]" data-name="Table Row">
      <TableCell4 />
      <TableCell5 />
    </div>
  );
}

function Container44() {
  return (
    <div className="absolute h-[20px] left-0 top-[12.5px] w-[370.039px]" data-name="Container">
      <p className="absolute font-['Inter:Medium',sans-serif] font-medium leading-[20px] left-0 not-italic text-[#101828] text-[14px] top-[0.5px] tracking-[-0.1504px]">servings</p>
    </div>
  );
}

function Container45() {
  return (
    <div className="absolute h-[16px] left-0 top-[34.5px] w-[370.039px]" data-name="Container">
      <p className="absolute font-['Inter:Regular',sans-serif] font-normal leading-[16px] left-0 not-italic text-[#6a7282] text-[12px] top-px">Number of servings</p>
    </div>
  );
}

function TableCell6() {
  return (
    <div className="absolute h-[63px] left-0 top-0 w-[386.039px]" data-name="Table Cell">
      <Container44 />
      <Container45 />
    </div>
  );
}

function NumberInput() {
  return (
    <div className="absolute h-[34px] left-0 rounded-[4px] top-[14.5px] w-[684.961px]" data-name="Number Input">
      <div className="content-stretch flex items-center overflow-clip px-[12px] py-[6px] relative rounded-[inherit] size-full">
        <p className="font-['Inter:Regular',sans-serif] font-normal leading-[20px] not-italic relative shrink-0 text-[#0a0a0a] text-[14px] tracking-[-0.1504px]">4</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[#d1d5dc] border-solid inset-0 pointer-events-none rounded-[4px]" />
    </div>
  );
}

function TableCell7() {
  return (
    <div className="absolute h-[63px] left-[386.04px] top-0 w-[684.961px]" data-name="Table Cell">
      <NumberInput />
    </div>
  );
}

function TableRow4() {
  return (
    <div className="absolute border-[#f3f4f6] border-b border-solid h-[63px] left-0 top-[189px] w-[1071px]" data-name="Table Row">
      <TableCell6 />
      <TableCell7 />
    </div>
  );
}

function TableBody() {
  return (
    <div className="absolute h-[252px] left-0 top-[36.5px] w-[1071px]" data-name="Table Body">
      <TableRow1 />
      <TableRow2 />
      <TableRow3 />
      <TableRow4 />
    </div>
  );
}

function Nt2() {
  return (
    <div className="absolute h-[289px] left-[16px] top-[64px] w-[1071px]" data-name="nt">
      <TableHeader />
      <TableBody />
    </div>
  );
}

function PrimitiveDiv() {
  return (
    <div className="h-[369px] relative shrink-0 w-full" data-name="Primitive.div">
      <TabList />
      <Nt2 />
    </div>
  );
}

function Nt() {
  return (
    <div className="bg-white content-stretch flex flex-col h-[370px] items-start pt-px relative shrink-0 w-full" data-name="nt">
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-solid border-t inset-0 pointer-events-none" />
      <PrimitiveDiv />
    </div>
  );
}

function Container37() {
  return (
    <div className="bg-white h-[256px] relative shrink-0 w-[1103px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip pt-px relative rounded-[inherit] size-full">
        <Nt />
      </div>
      <div className="absolute inset-0 pointer-events-none rounded-[inherit] shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)]" />
      <div aria-hidden="true" className="absolute border-[#e5e7eb] border-solid border-t inset-0 pointer-events-none" />
    </div>
  );
}

function Container25() {
  return (
    <div className="flex-[1_0_0] min-h-px min-w-px relative w-[1103px]" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[inherit] size-full">
        <Container26 />
        <Container37 />
      </div>
    </div>
  );
}

function Container20() {
  return (
    <div className="bg-[#f9fafb] flex-[1_0_0] h-[992px] min-h-px min-w-px relative" data-name="Container">
      <div className="bg-clip-padding border-0 border-[transparent] border-solid content-stretch flex flex-col items-start relative size-full">
        <Sn />
        <Container25 />
      </div>
    </div>
  );
}

function O() {
  return (
    <div className="bg-[#f9fafb] content-stretch flex h-[992px] items-start relative shrink-0 w-full" data-name="$o">
      <Cn />
      <Container20 />
    </div>
  );
}

export default function RecipeSiteStorybookUi() {
  return (
    <div className="bg-white content-stretch flex flex-col items-start relative size-full" data-name="Recipe Site Storybook UI">
      <O />
    </div>
  );
}