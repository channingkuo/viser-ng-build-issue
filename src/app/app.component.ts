import {
  Component, enableProdMode,
  AfterViewInit, HostListener,
  ViewChild
} from '@angular/core';
import { Http } from '@angular/http';
import 'zone.js';
import 'reflect-metadata';
// import * as $ from 'jquery';
import * as _ from 'lodash';
import { DataSet } from '@antv/data-set';
import { Map } from 'core-js';
import { environment } from '../environments/environment';

declare var AMapUI: any;
declare var AMap: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements AfterViewInit {
  showTitle = false;
  forceFit: Boolean = true;
  height: Number = 300;
  padding = [0, 0];
  data = [];
  geoData = {};

  colors = [
    '#3366cc',
    '#dc3912',
    '#ff9900',
    '#109618',
    '#990099',
    '#0099c6',
    '#dd4477',
    '#66aa00',
    '#b82e2e',
    '#316395',
    '#994499',
    '#22aa99',
    '#aaaa11',
    '#6633cc',
    '#e67300',
    '#8b0707',
    '#651067',
    '#329262',
    '#5574a6',
    '#3b3eac'
  ];

  polygonOpts = {
    position: 'longitude*lantitude',
    label: ['name', {
      textStyle: {
        fill: '#fff',
        fontSize: 10,
        shadowBlur: 2,
        shadowColor: 'rgba(0, 0, 0, .45)'
      },
    }],
    style: ['name', {
      textStyle: {
        fill: '#fff',
        fontSize: 10,
        shadowBlur: 2,
        shadowColor: 'rgba(0, 0, 0, .45)'
      },
    }],
    color: ['value', '#BAE7FF-#1890FF-#0050B3'],
  };

  name = '';
  currentAreaNode = null;
  districtExplorer = null;

  // control pane
  hideOrShow: Boolean = false;

  map: any;
  features = ['bg', 'road', 'building', 'point'];

  dangerPoint = [];

  @ViewChild('chart') chart;
  @ViewChild('scrollView') scrollView;

  constructor(public http: Http) {
    alert(environment.production);
  }

  @HostListener('mousemove') onMouseMove(para) {
    const e = para || window.event;
    const clientWidth = document.documentElement.clientWidth || document.body.clientWidth;
    this.hideOrShow = e.screenY <= 150 && e.screenX <= clientWidth - 400;
  }

  ngAfterViewInit() {
    // 调用高德 api 绘制底图以及获取 geo 数据
    this.map = new AMap.Map('china', {
      resizeEnable: true,
      zoom: 14,
      center: [120.677438, 31.300038], // 公司地址
      pitch: 50,                       // 地图俯仰角度，有效范围(0度 - 83度)
      viewMode: '3D'                   // 地图模式
    });
    const controlBar = new AMap.ControlBar({
      showZoomBar: true,
      showControlButton: true,
      position: {
        right: '10px',
        top: '10px'
      }
    });
    this.map.addControl(controlBar);

    const content = `
      <div class="co-logo">
        <div class="co-name">苏州药尚网</div>
        <div class="center-point"></div>
      </div>
    `;
    const marker = new AMap.Marker({
      position: new AMap.LngLat(120.670547, 31.294387),
      offset: new AMap.Pixel(-75, -110),
      content: content,
      title: '公司',
      zoom: 14
    });
    this.map.add(marker);

    // 加载数据点
    this.http.post('https://api.yao-shang-wang.com/api/public/ip/list?from=XCX', {
      longitude: 120.670547,
      latitude: 31.294387
    }).toPromise().then(resp => {
      const data = resp.json();
      if (data.success) {
        let markers = [];
        for (let i = 0; i < data.data.length; i++) {
          const ic = new AMap.Icon({
            size: new AMap.Size(50, 50),
            image: i === 2 ? '../assets/imgs/point-danger.png' : '../assets/imgs/point.png',
            imageOffset: new AMap.Pixel(0, 0),
            imageSize: new AMap.Size(50, 50)
          });
          const m = new AMap.Marker({
            position: this.bd_09_to_gcj_02(data.data[i].mapY, data.data[i].mapX),
            offset: new AMap.Pixel(-25, -50),
            icon: ic,
            title: data.data[i].name
          });
          if (i === 2) {
            m.setAnimation('AMAP_ANIMATION_BOUNCE');
            this.map.setZoom(16);
            this.map.panTo(this.bd_09_to_gcj_02(data.data[i].mapY, data.data[i].mapX));
            this.dangerPoint = [...this.dangerPoint, data.data[i], data.data[i], data.data[i], data.data[i], data.data[i], data.data[i]];
          }
          // label默认蓝框白底左上角显示，样式className为：amap-marker-label
          m.setLabel({
            offset: new AMap.Pixel(0, -35),
            content: data.data[i].name
          });
          m.on('click', (e) => {
            this.map.setZoom(16);
            this.map.panTo(e.lnglat);
          });
          markers = [...markers, m];
        }
        this.map.add(markers);
      }
    }).catch(err => {
      console.log(err);
    });

    // 加载高德地图UI组件库 DistrictExplorer
    AMapUI.load(['ui/geo/DistrictExplorer'], (DistrictExplorer) => {
      // 创建一个实例
      const districtExplorer = new DistrictExplorer({
        eventSupport: true,                 // 打开事件支持
        map: this.map                       // 注册到地图上
      });

      // feature被点击
      districtExplorer.on('featureClick', (e, feature) => {
        const props = feature.properties;
        // 如果存在子节点
        if (props.childrenNum > 0) {
          // 切换聚焦区域
          this.switch2AreaNode(props.adcode);
        }
      });

      // 外部区域被点击
      districtExplorer.on('outsideClick', (e) => {
        districtExplorer.locatePosition(e.originalEvent.lnglat, (error, routeFeatures) => {
          if (routeFeatures && routeFeatures.length > 1) {
            // 切换到省级区域
            this.switch2AreaNode(routeFeatures[1].properties.adcode);
          } else {
            // 切换到全国
            this.switch2AreaNode(100000);
          }
        }, {
            evelLimit: 4
          });
      });
      this.districtExplorer = districtExplorer;
      // 江苏省 320000       苏州 320500
      this.switch2AreaNode(320000);
    });

    // 选择市、区时地图移动到对应的区域
    this.chart.onPlotClick = (chart, ev) => {
      if (chart.data) {
        this.map.setZoom(14);
        if (chart.data['_origin']) {
          const center = this.getCenterOfGravityPoint(chart.data['_origin'].lantitude, chart.data['_origin'].longitude);
          this.map.panTo(center);
        } else {
          const center = this.getCenterOfGravityPoint(chart.data.lantitude, chart.data.longitude);
          this.map.panTo(center);
        }
      }
    };

    // 自动滚动scroll view
    let span = -1;
    const timer = setInterval(() => {
      span += 1;
      this.scrollView.nativeElement.scrollTo(0, span * 1);
      const offsetTop = this.getOffsetTopByBody(this.scrollView.nativeElement.children[this.scrollView.nativeElement.children.length - 1]);
      const clientHeight = this.scrollView.nativeElement.children[this.scrollView.nativeElement.children.length - 1].clientHeight;
      if (span * 1 >= offsetTop - clientHeight * 2 + 20) {
        span = -1;
      }
    }, 100);
  }

  /**
   *平移到公司所在位置
   * @memberof AppComponent
   */
  moveToCoLocation() {
    this.map.setZoom(14);
    this.map.panTo([120.670547, 31.294387]);
  }

  /**
   *选择显示的地图内容
   * @memberof AppComponent
   */
  removeShowContent = (content) => {
    const isExist = this.features.filter(item => {
      return item === content;
    }).length > 0;
    if (isExist) {
      this.features = this.features.filter(item => {
        return item !== content;
      });
    } else {
      this.features.push(content);
    }
    this.map.setFeatures(this.features);
  }

  /**
   * 刷新数据
   * @memberof AppComponent
   */
  refresh() {

  }

  /**
   * 切换区域后刷新区域显示内容
   * @memberof AppComponent
   */
  refreshAreaNode = (areaNode) => {
    this.districtExplorer.setHoverFeature(null);
    this.renderAreaPolygons(areaNode);
  }

  /**
   * 加载区域
   * @memberof AppComponent
   */
  loadAreaNode = (adcode, callback) => {
    this.districtExplorer.loadAreaNode(adcode, (error, areaNode) => {
      if (error) {
        if (callback) {
          callback(error);
        }
        return;
      }

      const adcoDe = areaNode.getAdcode();
      // 获取 geoJSON 数据
      const geoJSON = areaNode.getSubFeatures();
      const name = areaNode.getName();
      if (!geoJSON || this.currentAreaNode && ('' + this.currentAreaNode.getAdcode() === '' + adcoDe)) {
        return;
      }

      const mapData = {
        type: 'FeatureCollection',
        features: geoJSON
      };
      // TODO 构造虚拟数据 可按需求展示数据
      const userData = [];
      for (let i = 0; i < geoJSON.length; i++) {
        const nameS = geoJSON[i].properties.name;
        userData.push({
          name: nameS,
          value: Math.round(Math.random() * 1000),
        });
      }

      const ds = new DataSet();
      // geoJSON 经纬度数据
      const geoDataView = ds.createView().source(mapData, {
        type: 'GeoJSON',
      });

      // 用户数据
      const dvData = ds.createView().source(userData);
      dvData.transform({
        type: 'geo.region',
        field: 'name',
        geoDataView: geoDataView,
        as: ['longitude', 'lantitude'],
      });

      this.geoData = geoDataView;
      this.data = dvData;
      this.name = name;

      if (callback) {
        callback(null, areaNode);
      }
    });
  }

  /**
   * 绘制某个区域的边界
   * @memberof AppComponent
   */
  renderAreaPolygons = (areaNode) => {
    const node = _.cloneDeep(areaNode);
    this.districtExplorer.clearFeaturePolygons();
    // 绘制子区域
    this.districtExplorer.renderSubFeatures(node, (feature, i) => {
      const fillColor = this.colors[i % this.colors.length];
      const strokeColor = this.colors[this.colors.length - 1 - i % this.colors.length];
      return {
        cursor: 'default',
        bubble: true,
        strokeColor: strokeColor,   // 线颜色
        strokeOpacity: 1,           // 线透明度
        strokeWeight: 1,            // 线宽
        fillColor: fillColor,       // 填充色
        fillOpacity: 0.2,           // 填充透明度
      };
    });

    // 绘制父区域
    // this.districtExplorer.renderParentFeature(node, {
    //   cursor: 'default',
    //   bubble: true,
    //   strokeColor: 'black', // 线颜色
    //   strokeOpacity: 1, // 线透明度
    //   strokeWeight: 1, // 线宽
    //   fillColor: null, // 填充色
    //   fillOpacity: 0.35, // 填充透明度
    // });
  }

  /**
   * 切换区域
   * @memberof AppComponent
   */
  switch2AreaNode = (adcode, callback = null) => {
    if (this.currentAreaNode && ('' + this.currentAreaNode.getAdcode() === '' + adcode)) {
      return;
    }

    this.loadAreaNode(adcode, (error, areaNode) => {
      if (error) {
        if (callback) {
          callback(error);
        }
        return;
      }

      this.currentAreaNode = areaNode;
      this.refreshAreaNode(areaNode);
      if (callback) {
        callback(null, areaNode);
      }
    });
  }

  /**
   * 计算不规则几何图形的重心
   * @param {Array<number>} lat
   * @param {Array<number>} lng
   * @returns
   * @memberof AppComponent
   */
  getCenterOfGravityPoint(lat: Array<number>, lng: Array<number>) {
    let area = 0.0;
    let gx = 0.0;
    let gy = 0.0;

    for (let i = 1; i <= lat.length; i++) {
      const iLat = lat[i % lat.length];
      const iLng = lng[i % lat.length];
      const nextLat = lat[i - 1];
      const nextLng = lng[i - 1];
      const temp = (iLat * nextLng - iLng * nextLat) / 2.0;
      area += temp;
      gx += temp * (iLat + nextLat) / 3.0;
      gy += temp * (iLng + nextLng) / 3.0;
    }
    gx = gx / area;
    gy = gy / area;
    return [gy, gx];
  }

  /**
   * 百度坐标转火星坐标
   * @param {number} lat
   * @param {number} lng
   * @memberof AppComponent
   */
  bd_09_to_gcj_02(lat: number, lng: number) {
    const x = lng - 0.0065;
    const y = lat - 0.006;
    const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * Math.PI);
    const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * Math.PI);
    return [z * Math.sin(theta), z * Math.cos(theta)];
  }

  /**
   * 计算dom元素到body的offsetTop值
   * @memberof AppComponent
   */
  getOffsetTopByBody(el) {
    let offsetTop = 0;
    while (el && el.tagName !== 'BODY') {
      offsetTop += el.offsetTop;
      el = el.offsetParent;
    }
    return offsetTop;
  }
}
